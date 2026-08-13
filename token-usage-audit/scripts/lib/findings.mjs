/**
 * Findings engine.
 *
 * Every finding declares the canonical fields and source capabilities it needs.
 * A source that cannot supply them gets the finding SKIPPED with a stated reason, * never a confident zero. That gate is what lets this tool claim "any harness"
 * honestly instead of quietly emitting empty reports for tools it can't read.
 *
 * Findings also declare `overlaps`: several describe the same dollars from
 * different angles, and those are excluded from the headline total rather than
 * being double-counted into an impressive-looking number.
 */

import { cacheReadRate, usd } from "./cost.mjs";

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const kt = (n) => `${(n / 1000).toFixed(0)}k`;

export const DEFAULTS = {
  targetContext: 120_000,
  longSessionTurns: 150,
  bigToolOutputTokens: 5_000,
  redundantReadThreshold: 3,
};

/**
 * Cache-read spend is a single measured pool. Several findings explain *why* that
 * pool is large, they are decompositions of it, not independent savings. Capping
 * each at the pool keeps a modelled estimate from claiming more than was actually
 * spent, and `overlaps` keeps them out of the headline total.
 */
const capToPool = (cost, agg) => Math.min(cost, agg.cacheReadCost || Infinity);

const F = [];
const define = (f) => { F.push(f); return f; };

// ---------------------------------------------------------------- 1

define({
  id: "context-bloat",
  builtin: "/usage flags 'long context' as a behavior flag at >=10% of recent usage; /context shows the live breakdown",
  title: "Oversized context re-read on every turn",
  requires: { caps: ["cache"], fields: ["cache_read_tokens"] },
  compute(agg, opt) {
    const target = opt.targetContext;
    const rows = [];
    let excessCost = 0;

    for (const s of agg.sessions.values()) {
      if (!s.ctx.length) continue;
      const rate = cacheReadRate(opt.pricing, s.model);
      if (rate == null) continue;
      const excess = sum(s.ctx.map((c) => Math.max(0, c - target)));
      if (excess <= 0) continue;
      const cost = excess * rate;
      excessCost += cost;
      rows.push({ session: s.id, project: s.project, turns: s.turns, avg: s.avgCtx, peak: s.peakCtx, cost });
    }
    if (!rows.length) return null;
    rows.sort((a, b) => b.cost - a.cost);
    excessCost = capToPool(excessCost, agg);

    const totalRead = sum([...agg.sessions.values()].map((s) => s.cacheReadTokens));
    return {
      cost: excessCost,
      estimate: true,
      headline:
        `Cache reads are ${pct(excessCost, agg.totalCost).toFixed(0)}% of spend above a ${kt(target)}-token working set. ` +
        `Median context ${kt(median([...agg.sessions.values()].flatMap((s) => s.ctx)))}, ` +
        `peak ${kt(Math.max(0, ...[...agg.sessions.values()].map((s) => s.peakCtx)))}.`,
      detail: [
        `Every turn re-reads the whole conversation. A turn at ${kt(400_000)} costs 4x a turn at ${kt(100_000)}`,
        `for identical work. Total cache-read volume: ${(totalRead / 1e9).toFixed(2)}B tokens.`,
        `Counterfactual: had every turn been capped at ${kt(target)}, cache-read spend would fall by ${usd(excessCost)}.`,
      ].join(" "),
      table: rows.slice(0, opt.top).map((r) => ({
        session: r.session.slice(0, 8), project: (r.project || "").split("/").pop(),
        turns: r.turns, avg_ctx: kt(r.avg), peak_ctx: kt(r.peak), excess_cost: usd(r.cost),
      })),
      fix: {
        kind: "behavioral",
        summary: "Reset context at task boundaries instead of running one long session.",
        actions: [
          "Start a fresh session per task; a 700-turn session pays for its own history on every turn.",
          "Install the context meter (apply.mjs does this) so growth is visible before it compounds.",
          "Delegate wide file-reading to a subagent, its context is discarded on return.",
        ],
      },
    };
  },
});

// ---------------------------------------------------------------- 2

define({
  id: "session-sprawl",
  builtin: "/usage, press w for the 7-day view",
  title: "Sessions that never reset",
  requires: { fields: ["session_id"] },
  overlaps: ["context-bloat"],
  compute(agg, opt) {
    const long = [...agg.sessions.values()].filter((s) => s.turns >= opt.longSessionTurns);
    if (!long.length) return null;
    long.sort((a, b) => b.cost - a.cost);
    const share = pct(sum(long.map((s) => s.cost)), agg.totalCost);
    return {
      cost: sum(long.map((s) => s.cost)),
      estimate: false,
      headline: `${long.length} sessions ran ≥${opt.longSessionTurns} turns and account for ${share.toFixed(0)}% of all spend.`,
      detail:
        "Same dollars as context-bloat, viewed per session rather than per turn, excluded from the " +
        "headline total to avoid double counting. Useful for spotting which work habits produce the bloat.",
      table: long.slice(0, opt.top).map((s) => ({
        session: s.id.slice(0, 8), project: (s.project || "").split("/").pop(),
        turns: s.turns, peak_ctx: kt(s.peakCtx), cost: usd(s.cost),
      })),
      fix: { kind: "behavioral", summary: "Split long-running work into per-task sessions.", actions: [] },
    };
  },
});

// ---------------------------------------------------------------- 3

define({
  id: "compaction-pressure",
  builtin: "/autocompact to set the window, /compact for a manual pass",
  title: "Context compaction churn",
  requires: { caps: ["compaction"] },
  compute(agg, opt) {
    const c = agg.compactions;
    if (!c.length) return null;
    const auto = c.filter((x) => x.trigger === "auto").length;
    // A compaction pays to read the pre-context and re-write the post-context.
    const rate = cacheReadRate(opt.pricing, agg.dominantModel) ?? 0;
    const cost = sum(c.map((x) => (x.pre_tokens || 0) * rate));
    return {
      cost,
      estimate: true,
      headline: `${c.length} compactions (${auto} automatic). Largest discarded ${kt(Math.max(...c.map((x) => x.pre_tokens || 0)))} tokens of context.`,
      detail:
        "Each compaction re-reads the entire context to summarize it, then re-caches the summary. " +
        "Automatic compactions in particular mean the session was already past the point where " +
        "it should have been reset, you pay full price for context you are about to throw away.",
      table: c.slice(-opt.top).map((x) => ({
        trigger: x.trigger, pre: kt(x.pre_tokens || 0), post: kt(x.post_tokens || 0),
        discarded: kt((x.pre_tokens || 0) - (x.post_tokens || 0)),
      })),
      fix: { kind: "behavioral", summary: "Reset before the harness has to compact for you.", actions: [] },
    };
  },
});

// ---------------------------------------------------------------- 4

define({
  id: "model-routing",
  builtin: "/model to switch or set a default; /usage attributes usage by subagent and skill",
  title: "Spend concentrated in expensive models",
  requires: { fields: ["model"] },
  compute(agg, opt) {
    const rows = [...agg.byModel.entries()]
      .map(([model, m]) => ({ model, turns: m.turns, cost: m.cost, perTurn: m.cost / m.turns }))
      .sort((a, b) => b.cost - a.cost);
    if (rows.length < 2) return null;

    const top = rows[0];
    const cheapest = [...rows].sort((a, b) => a.perTurn - b.perTurn)[0];
    return {
      cost: 0, // routing is a recommendation, not a measured waste, no dollars claimed
      estimate: true,
      headline: `${top.model} is ${pct(top.cost, agg.totalCost).toFixed(0)}% of spend (${usd(top.cost)} over ${top.turns} turns, ${usd(top.perTurn)}/turn).`,
      detail:
        `Cheapest model in use is ${cheapest.model} at ${usd(cheapest.perTurn)}/turn, a ` +
        `${(top.perTurn / (cheapest.perTurn || 1)).toFixed(0)}x difference. This finding claims no ` +
        `dollar saving: whether a turn needed the expensive model is a judgement about output quality ` +
        `that usage logs cannot make. It reports the ratio; you decide.`,
      table: rows.map((r) => ({
        model: r.model, turns: r.turns, cost: usd(r.cost),
        per_turn: usd(r.perTurn), share: `${pct(r.cost, agg.totalCost).toFixed(0)}%`,
      })),
      fix: {
        kind: "config",
        summary: "Review which agent definitions pin an expensive model tier.",
        actions: ["apply.mjs surfaces every agent definition with its model and measured spend."],
      },
    };
  },
});

// ---------------------------------------------------------------- 5

define({
  id: "subagent-roi",
  builtin: "/usage attribution breaks recent usage down by subagent",
  title: "Delegations that cost more than they returned",
  requires: { caps: ["subagents"] },
  compute(agg, opt) {
    if (!agg.subagents.length) return null;
    const byType = new Map();
    for (const s of agg.subagents) {
      const k = s.agent_type || "unknown";
      const e = byType.get(k) || { calls: 0, tokens: 0, tools: 0, bytes: 0, models: new Set() };
      e.calls++; e.tokens += s.total_tokens || 0; e.tools += s.tool_uses || 0;
      e.bytes += s.result_bytes || 0;
      if (s.model) e.models.add(s.model);
      byType.set(k, e);
    }
    const rows = [...byType.entries()].map(([agent, e]) => {
      const rate = cacheReadRate(opt.pricing, [...e.models][0] || agg.dominantModel) ?? 0;
      return {
        agent, calls: e.calls, tokens: e.tokens,
        approxCost: e.tokens * rate,
        toolsPerCall: e.tools / e.calls,
        bytesPerCall: e.bytes / e.calls,
        models: [...e.models].join(", ") || "unrecorded",
      };
    }).sort((a, b) => b.tokens - a.tokens);

    const lowValue = rows.filter((r) => r.toolsPerCall < 2 && r.calls >= 3);
    return {
      cost: 0,
      estimate: true,
      headline: `${agg.subagents.length} delegations across ${rows.length} agent types, ${(sum(rows.map((r) => r.tokens)) / 1e6).toFixed(1)}M tokens.`,
      detail:
        (lowValue.length
          ? `${lowValue.map((r) => r.agent).join(", ")} averaged under 2 tool calls per delegation, ` +
            "that is the signature of work that could have been done inline without paying to " +
            "rebuild context in a fresh agent. "
          : "No agent type shows the low-tool-use signature of unnecessary delegation. ") +
        "Delegation cost is reported without a claimed saving: a subagent that returns a good answer " +
        "in one tool call may be worth every token.",
      table: rows.map((r) => ({
        agent: r.agent, calls: r.calls, tokens: `${(r.tokens / 1e6).toFixed(2)}M`,
        tools_per_call: r.toolsPerCall.toFixed(1),
        result_kb: (r.bytesPerCall / 1024).toFixed(1), model: r.models,
      })),
      fix: { kind: "review", summary: "Check whether cheap-model delegation would do.", actions: [] },
    };
  },
});

// ---------------------------------------------------------------- 6

define({
  id: "session-start-overhead",
  builtin: "/context shows exactly what the resident prefix contains",
  title: "Fixed per-session startup tax",
  requires: { caps: ["cache"], fields: ["cache_write_tokens"] },
  overlaps: ["context-bloat"],
  compute(agg, opt) {
    const firsts = [...agg.sessions.values()].map((s) => s.firstWrite).filter((x) => x > 0);
    if (!firsts.length) return null;
    const med = median(firsts);
    const rate = cacheReadRate(opt.pricing, agg.dominantModel) ?? 0;
    // The prefix is written once per session and then re-read on every subsequent turn.
    const turns = sum([...agg.sessions.values()].map((s) => s.turns));
    const cost = capToPool(med * turns * rate, agg);
    return {
      cost,
      estimate: true,
      headline: `Median session starts at ${kt(med)} resident tokens before any work happens.`,
      detail:
        "This is the system prompt, tool schemas, instruction files and skill descriptions, paid " +
        "once as a cache write per session, then re-read on every single turn. Across " +
        `${turns} turns that resident prefix costs about ${usd(cost)}. It is also the cleanest ` +
        "benchmark target: shrink it and the saving is deterministic, not workload-dependent. " +
        "Run `benchmark.mjs snapshot` then `verify` to measure it exactly.",
      table: [{ metric: "median first-turn cache write", value: kt(med) },
              { metric: "sessions", value: String(agg.sessions.size) },
              { metric: "total turns re-reading it", value: String(turns) }],
      fix: {
        kind: "config",
        summary: "Trim the always-resident prefix: instruction files, unused skills, unused MCP servers.",
        actions: ["apply.mjs reports the token weight of each resident file so you can see what to cut."],
      },
    };
  },
});

// ---------------------------------------------------------------- 7

define({
  id: "tool-output-waste",
  builtin: "/context shows what is occupying the window right now",
  title: "Large tool outputs re-read for the rest of the session",
  requires: { caps: ["tool_results"] },
  overlaps: ["context-bloat"],
  compute(agg, opt) {
    const big = agg.bigOutputs.filter((o) => o.tokens >= opt.bigToolOutputTokens);
    if (!big.length) return null;
    const rate = cacheReadRate(opt.pricing, agg.dominantModel) ?? 0;
    let cost = 0;
    const rows = [];
    for (const o of big) {
      const s = agg.sessions.get(o.session_id);
      if (!s) continue;
      // Carried only until the next compaction, not blindly to the end of the session.
      const remaining = Math.max(0, (o.carriedUntil ?? s.turns) - (o.turnAt || 0));
      const c = o.tokens * remaining * rate;
      cost += c;
      rows.push({ ...o, remaining, c });
    }
    cost = capToPool(cost, agg);
    rows.sort((a, b) => b.c - a.c);
    return {
      cost,
      estimate: true,
      headline: `${big.length} tool results over ${(opt.bigToolOutputTokens / 1000).toFixed(0)}k tokens stayed in context for the rest of their session.`,
      detail:
        "A large output is not paid once. It is written to cache once and then re-read on every " +
        "subsequent turn of that session, so its true cost scales with how early it landed.",
      table: rows.slice(0, opt.top).map((r) => ({
        tool: r.tool || "?",
        kind: r.media === "image" ? "image" : "text",
        target: r.target ? r.target.split("/").pop().slice(0, 28) : "(inline)",
        tokens: r.tokens, turns_carried: r.remaining, cost: usd(r.c),
      })),
      fix: {
        kind: "behavioral",
        summary: "Filter big outputs at the source.",
        actions: [
          "Pipe long command output through head/grep/jq rather than dumping it whole.",
          "Read specific line ranges instead of entire large files.",
          "Send wide searches to a subagent so the raw output never enters the main context.",
        ],
      },
    };
  },
});

// ---------------------------------------------------------------- 8

define({
  id: "redundant-reads",
  builtin: "/insights reports friction patterns across recent sessions",
  title: "The same file read repeatedly in one session",
  requires: { caps: ["tool_results"] },
  overlaps: ["tool-output-waste"],
  compute(agg, opt) {
    const rows = [];
    for (const [key, e] of agg.repeatReads) {
      if (e.count < opt.redundantReadThreshold) continue;
      rows.push({ target: key.split("::")[1], count: e.count, bytes: e.bytes, tokens: e.tokens || 0 });
    }
    if (!rows.length) return null;
    const rate = cacheReadRate(opt.pricing, agg.dominantModel) ?? 0;
    const cost = capToPool(sum(rows.map((r) => (r.tokens / r.count) * (r.count - 1) * rate)), agg);
    rows.sort((a, b) => b.count - a.count);
    return {
      cost,
      estimate: true,
      headline: `${rows.length} files were read ${opt.redundantReadThreshold}+ times within a single session.`,
      detail:
        "Each re-read adds another full copy of the file to the context, which then rides along on " +
        "every later turn. Overlaps with tool-output-waste and is excluded from the headline total.",
      table: rows.slice(0, opt.top).map((r) => ({
        file: r.target.split("/").pop(), reads: r.count, tokens_each: Math.round(r.tokens / r.count),
      })),
      fix: { kind: "behavioral", summary: "Re-reading a file you already read adds a copy, not a refresh.", actions: [] },
    };
  },
});

// ---------------------------------------------------------------- 9

define({
  id: "cache-ttl-fit",
  builtin: "/usage flags 'cache misses' as a behavior flag when they are significant",
  title: "Cache TTL mismatched to actual turn gaps",
  requires: { caps: ["cache_ttl"] },
  compute(agg, opt) {
    const { w5m, w1h } = agg.cacheWrites;
    if (!w5m && !w1h) return null;
    const gaps = agg.turnGaps.filter((g) => g > 0);
    const medGap = median(gaps) / 1000;
    const longGapShare = pct(gaps.filter((g) => g > 300e3).length, gaps.length);
    return {
      cost: 0,
      estimate: true,
      headline: `${pct(w1h, w5m + w1h).toFixed(0)}% of cache writes use the 1h TTL; median gap between turns is ${medGap.toFixed(0)}s.`,
      detail:
        `A 1h write costs 2x base input, a 5m write 1.25x. The 1h TTL pays off only when gaps ` +
        `regularly exceed 5 minutes, here ${longGapShare.toFixed(0)}% of gaps do. ` +
        (longGapShare < 20 && w1h > w5m
          ? "Most turns follow quickly, so the 1h premium is largely being paid for nothing."
          : "The current mix looks reasonable for this gap distribution."),
      table: [{ metric: "5m write tokens", value: kt(w5m) }, { metric: "1h write tokens", value: kt(w1h) },
              { metric: "median turn gap", value: `${medGap.toFixed(0)}s` },
              { metric: "gaps > 5 min", value: `${longGapShare.toFixed(0)}%` }],
      fix: { kind: "review", summary: "TTL is harness-controlled; report only.", actions: [] },
    };
  },
});

// ---------------------------------------------------------------- 10

define({
  id: "tool-schema-tax",
  builtin: "/mcp lists configured servers; /context shows their schema cost",
  title: "Tool schemas loaded but never invoked",
  requires: { caps: ["tool_results"] },
  compute(agg, opt) {
    if (!agg.toolsUsed.size) return null;
    const mcp = [...agg.toolsUsed].filter((t) => t.startsWith("mcp__"));
    const servers = new Map();
    for (const t of mcp) {
      const server = t.split("__")[1];
      servers.set(server, (servers.get(server) || 0) + 1);
    }
    return {
      cost: 0,
      estimate: true,
      headline: `${agg.toolsUsed.size} distinct tools were actually invoked${mcp.length ? `, ${mcp.length} of them from MCP servers` : ""}.`,
      detail:
        "Every connected MCP server's tool schemas sit in the resident prefix of every request, " +
        "whether or not you call them. Cross-reference this list against your configured servers: " +
        "any server with zero invocations is pure overhead on every turn. Exact schema token cost " +
        "is measured by `benchmark.mjs snapshot`, which reads the live tool list.",
      table: [...servers.entries()].map(([server, calls]) => ({ mcp_server: server, calls })),
      fix: {
        kind: "config",
        summary: "Disable MCP servers you never call, or enable tool deferral.",
        actions: [],
      },
    };
  },
});

// ---------------------------------------------------------------- 11

define({
  id: "wasted-turns",
  builtin: "/insights covers misunderstood requests and rework",
  title: "Turns spent on errors and retries",
  requires: { caps: ["errors"] },
  compute(agg, opt) {
    const n = agg.errors;
    if (!n) return null;
    const avgTurnCost = agg.totalCost / Math.max(1, agg.totalTurns);
    return {
      cost: n * avgTurnCost,
      estimate: true,
      headline: `${n} API errors / refusals / interruptions.`,
      detail:
        `Priced at the average turn cost (${usd(avgTurnCost)}). Errors still pay for the context ` +
        "they read, and a retry pays for it again.",
      table: [{ metric: "error turns", value: String(n) },
              { metric: "share of turns", value: `${pct(n, agg.totalTurns).toFixed(1)}%` }],
      fix: { kind: "review", summary: "Recurring errors at high context often mean the session is too large.", actions: [] },
    };
  },
});

// ----------------------------------------------------------------

// ---------------------------------------------------------------- 12

define({
  id: "expensive-failures",
  title: "Sessions that cost the most and still went badly",
  builtin: "/insights produced the outcome labels this joins against",
  requires: { insights: true },
  overlaps: ["context-bloat"],
  compute(agg, opt) {
    const j = opt.join;
    if (!j || !j.rows.length) return null;
    const bad = j.rows.filter((r) => r.outcome === "not_achieved" || r.outcome === "partially_achieved");
    if (!bad.length) return null;
    bad.sort((a, b) => b.cost - a.cost);
    const cost = sum(bad.map((r) => r.cost));
    const perGood = j.rows.filter((r) => r.outcome === "fully_achieved");
    const avgGood = perGood.length ? sum(perGood.map((r) => r.cost)) / perGood.length : 0;
    const avgBad = cost / bad.length;
    return {
      cost,
      estimate: false,
      headline:
        `${bad.length} sessions ended not or only partially achieved, costing ${usd(cost)} ` +
        `(${usd(avgBad)} each vs ${usd(avgGood)} for a fully achieved session).`,
      detail:
        "This is the one number neither tool produces alone: cost is measured here, the " +
        "outcome label comes from /insights, and they join on session id. A cheap failure " +
        "is a bad half hour; an expensive one is the thing worth changing. " +
        (avgBad > avgGood
          ? "Failed sessions here cost MORE than successful ones, which usually means the " +
            "session ran long in the wrong direction rather than stopping early."
          : "Failed sessions cost less than successful ones, so failures are being caught early."),
      table: bad.slice(0, opt.top).map((r) => ({
        session: r.id.slice(0, 8), project: (r.project || "").split("/").pop(),
        outcome: r.outcome.replace("_achieved", ""), turns: r.turns,
        cost: usd(r.cost), friction: r.frictions.slice(0, 2).join(",") || "-",
      })),
      fix: {
        kind: "review",
        summary: "Read the brief_summary for these sessions in the insights facets.",
        actions: ["Look for the point where the session should have been stopped or reset."],
      },
    };
  },
});

// ---------------------------------------------------------------- 13

define({
  id: "cost-weighted-friction",
  title: "Friction ranked by what it actually costs",
  builtin: "/insights counts these frictions; this weights them by session cost",
  requires: { insights: true },
  overlaps: ["context-bloat"],
  compute(agg, opt) {
    const j = opt.join;
    if (!j || !j.rows.length) return null;
    const byType = new Map();
    for (const r of j.rows) {
      for (const f of r.frictions) {
        const e = byType.get(f) || { sessions: 0, cost: 0, turns: 0 };
        e.sessions++; e.cost += r.cost; e.turns += r.turns;
        byType.set(f, e);
      }
    }
    if (!byType.size) return null;
    const rows = [...byType.entries()]
      .map(([type, e]) => ({ type, ...e, per: e.cost / e.sessions }))
      .sort((a, b) => b.cost - a.cost);
    const top = rows[0];
    return {
      cost: 0,
      estimate: true,
      headline:
        `"${top.type}" appears in ${top.sessions} sessions carrying ${usd(top.cost)} of spend ` +
        `(${usd(top.per)} per affected session).`,
      detail:
        "A raw friction count treats a 20-turn annoyance the same as a 1,100-turn one. " +
        "Weighting by the cost of the sessions each friction appeared in re-ranks them by " +
        "what they are actually worth fixing. No saving is claimed: friction correlates " +
        "with expensive sessions, it does not necessarily cause the expense.",
      table: rows.slice(0, opt.top).map((r) => ({
        friction: r.type, sessions: r.sessions, turns: r.turns,
        total: usd(r.cost), per_session: usd(r.per),
      })),
      fix: { kind: "review", summary: "Address the top-weighted friction first, not the most frequent.", actions: [] },
    };
  },
});

export function runFindings(agg, opt) {
  const results = [];
  const skipped = [];

  for (const f of F) {
    if (f.requires?.insights && !opt.join) {
      skipped.push({
        id: f.id, title: f.title,
        reason: "requires /insights data, run /insights in Claude Code, then re-run this audit",
      });
      continue;
    }
    const caps = f.requires?.caps || [];
    const missing = caps.filter((c) => !opt.capabilities.includes(c));
    if (missing.length) {
      skipped.push({
        id: f.id, title: f.title,
        reason: `source "${opt.sourceName}" does not record ${missing.join(", ")}`,
      });
      continue;
    }
    let out = null;
    try { out = f.compute(agg, opt); } catch (e) {
      skipped.push({ id: f.id, title: f.title, reason: `error: ${e.message}` });
      continue;
    }
    if (!out) { skipped.push({ id: f.id, title: f.title, reason: "no occurrences in this window" }); continue; }
    results.push({ id: f.id, title: f.title, overlaps: f.overlaps || [], builtin: f.builtin || null, ...out });
  }

  results.sort((a, b) => b.cost - a.cost);
  const counted = results.filter((r) => !r.overlaps.length);
  return { findings: results, skipped, addressable: sum(counted.map((r) => r.cost)) };
}
