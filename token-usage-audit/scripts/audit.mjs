#!/usr/bin/env node
/**
 * token-usage-audit, audit
 *
 * Reads local agent logs, prices them per provider, and reports where the money
 * actually goes, ranked by cost, with a named fix for each finding.
 */

import { stat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

import { loadPricing, usd } from "./lib/cost.mjs";
import { loadSourceDefs, detectSources, readSource, parseSince } from "./lib/sources.mjs";
import { createAggregator } from "./lib/aggregate.mjs";
import { runFindings, DEFAULTS } from "./lib/findings.mjs";
import { loadInsights, joinSessions } from "./lib/insights.mjs";

const HELP = `
token-usage-audit, where your AI coding spend actually goes

  node scripts/audit.mjs [options]

  --source <name|all>     source to audit (default: auto, every source with data)
  --since <7d|24h|ISO>    only consider entries newer than this
  --project <substring>   restrict to projects whose path contains this
  --top <n>               rows per table (default 10)
  --target-context <n>    working-set size for the bloat counterfactual (default ${DEFAULTS.targetContext})
  --pricing <file>        override pricing.json
  --plan <usd/month>      you pay a flat subscription, reframe money as plan value
  --json                  machine-readable output
  --list-sources          show detected sources and exit
  --help

Dollar figures are API list-price EQUIVALENTS computed from local logs. If you are
on a flat-rate subscription they are not money you spend, pass --plan <usd/month>
and they will be reported as the value you extract from your plan instead.
`;

function parseArgs(argv) {
  const o = {
    source: "auto", since: null, project: null, top: 10,
    targetContext: DEFAULTS.targetContext, pricing: undefined, json: false, list: false,
    plan: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--source": o.source = next(); break;
      case "--since": o.since = parseSince(next()); break;
      case "--project": o.project = next(); break;
      case "--top": o.top = Number(next()); break;
      case "--target-context": o.targetContext = Number(next()); break;
      case "--pricing": o.pricing = next(); break;
      case "--plan": o.plan = Number(next()); break;
      case "--json": o.json = true; break;
      case "--list-sources": o.list = true; break;
      case "--help": case "-h": console.log(HELP); process.exit(0);
      default: throw new Error(`unknown option: ${a}`);
    }
  }
  return o;
}

// ---------------------------------------------------------------- rendering

const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);

function table(rows) {
  if (!rows?.length) return "";
  const cols = Object.keys(rows[0]);
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (cells) => "  " + cells.map((c, i) => String(c ?? "").padEnd(w[i])).join("  ");
  return [dim(line(cols)), ...rows.map((r) => line(cols.map((c) => r[c])))].join("\n");
}

function wrap(text, width = 84, indent = "  ") {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const word of words) {
    if ((cur + " " + word).trim().length > width) { lines.push(cur.trim()); cur = word; }
    else cur += " " + word;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.map((l) => indent + l).join("\n");
}

/**
 * The harness ships its own usage tooling. This report is stronger when read
 * alongside it, not instead of it: /usage is authoritative on plan limits (which
 * local logs cannot see at all), and /insights covers workflow patterns rather
 * than tokens. Point at both rather than pretending to replace them.
 */
async function builtinsStatus() {
  const dir = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "usage-data");
  let insights = null;
  try {
    const reports = (await readdir(dir)).filter((f) => f.endsWith(".html"));
    if (reports.length) {
      const st = await stat(join(dir, "report.html"));
      insights = { path: join(dir, "report.html"), ageDays: (Date.now() - st.mtimeMs) / 86400e3, count: reports.length };
    }
  } catch { /* never run */ }
  return { insights, dir };
}

function reportBuiltins(b, join) {
  console.log("\n" + bold("  Corroborate with the harness's own tooling"));
  console.log(dim("    This report reads local logs. Two things it structurally cannot see:"));
  console.log(`    ${bold("/usage")}     plan limits and remaining headroom, the only source for whether any`);
  console.log(dim("               of this matters. Also attributes usage by skill, subagent and MCP"));
  console.log(dim("               server, and flags 'long context' / 'cache misses' behaviours."));
  if (b.insights) {
    const age = b.insights.ageDays;
    console.log(`    ${bold("/insights")}  report from ${age < 1 ? "today" : `${age.toFixed(0)}d ago`} at ${b.insights.path.replace(homedir(), "~")}`);
    if (age > 7) {
      console.log(dim("               stale. Refresh non-interactively:  claude -p \"/insights\""));
    }
  } else {
    console.log(`    ${bold("/insights")}  never run. It finds workflow friction that token counts cannot.`);
    console.log(dim("               Run it non-interactively:  claude -p \"/insights\""));
    console.log(dim("               It costs tokens (a model analysis), so gate re-runs on age."));
  }
  if (join) {
    console.log(dim(`\n    Joined ${join.matched} of ${join.costed} costed sessions against /insights facets ` +
      `(${(join.coverage * 100).toFixed(0)}% coverage).`));
    if (join.coverage < 0.8) console.log(dim("    Below 80%: re-run /insights so the joined findings cover recent work."));
  }
  console.log(dim("\n    Where a finding above has a cross-check line, that is the native command"));
  console.log(dim("    which confirms it independently. Trust it over this report on plan limits."));
}

// ---------------------------------------------------------------- main

async function auditSource(detected, opt, pricing, insights) {
  const { def } = detected;
  const agg = createAggregator(pricing);

  const stats = await readSource(detected, {
    since: opt.since,
    onRecord: (r) => {
      if (opt.project && !(r.project || "").includes(opt.project)) return;
      agg.record(r);
    },
    onEvent: (e) => agg.event(e),
  });

  const a = agg.finalize();
  const join = insights?.available && def.name === "claude-code" ? joinSessions(a, insights) : null;
  const { findings, skipped, addressable } = runFindings(a, {
    ...opt,
    pricing,
    join,
    capabilities: def.capabilities || [],
    sourceName: def.name,
    longSessionTurns: DEFAULTS.longSessionTurns,
    bigToolOutputTokens: DEFAULTS.bigToolOutputTokens,
    redundantReadThreshold: DEFAULTS.redundantReadThreshold,
  });

  return { def, stats, agg: a, findings, skipped, addressable, join };
}

function report(res, opt) {
  const { def, stats, agg, findings, skipped, addressable } = res;

  console.log("\n" + bold(`═══ ${def.display_name || def.name} ═══`));
  if (def.status === "unverified") {
    console.log(dim(`  ⚠ This source mapping is UNVERIFIED, field paths were never confirmed against a
    real install. If the record count below looks wrong, the mapping is wrong, not your usage.`));
  }

  const days = agg.window.from && agg.window.to
    ? Math.max(1, (agg.window.to - agg.window.from) / 86400e3) : 1;

  console.log(dim(`  ${stats.records.toLocaleString()} priced turns across ${agg.sessions.size} sessions` +
    `, ${stats.files} files, ${days.toFixed(0)} days` +
    (stats.deduped ? `, ${stats.deduped.toLocaleString()} duplicates dropped` : "") +
    (stats.malformed ? `, ${stats.malformed} malformed lines skipped` : "")));

  if (!stats.records) {
    console.log("\n  No usable token records. The source is installed but logs no usage this tool can read.");
    return;
  }

  if (opt.plan) {
    // Flat-rate subscription: the dollars are not spend, they are the API list
    // price of the same work. Reporting them as spend is simply wrong, and it
    // sends people optimizing a bill they do not have.
    const months = days / 30.44;
    const planCost = opt.plan * months;
    console.log("\n" + bold("  Plan value") + dim("  (you pay a flat subscription, these are not costs)"));
    console.log(`    subscription        ${usd(planCost)}   ${dim(`${usd(opt.plan)}/month over ${days.toFixed(0)} days`)}`);
    console.log(`    API-equivalent      ${usd(agg.totalCost)}   ${dim("what this usage would cost at list price")}`);
    console.log(`    ${bold("value ratio")}         ${bold((agg.totalCost / planCost).toFixed(1) + "x")}   ${dim("higher is better, you are ahead by this much")}`);
    console.log("\n" + dim("    Reducing the numbers below does NOT save you money; your plan is flat."));
    console.log(dim("    What it buys is rate-limit headroom and less context for the model to wade"));
    console.log(dim("    through. Optimize only if you hit limits or want tighter sessions."));
  } else {
    console.log("\n" + bold("  API-equivalent value") + dim("  (list price of this usage, not a bill)"));
    console.log(`    total          ${usd(agg.totalCost)}   ${dim(`(~${usd(agg.totalCost / days)}/day)`)}`);
    console.log(`    addressable    ${usd(addressable)}   ${dim(`${((addressable / agg.totalCost) * 100).toFixed(0)}%, sum of non-overlapping findings below`)}`);
    console.log(dim("    On a flat-rate subscription these are not money you spend, pass --plan <usd/month>."));
  }

  if (agg.unpriced.size) {
    console.log("\n" + bold("  ⚠ Unpriced models") + dim(" (excluded from every total above, never costed at zero)"));
    for (const [model, e] of agg.unpriced) {
      console.log(`    ${model}: ${e.turns} turns, ${(e.tokens / 1e6).toFixed(2)}M tokens, ${e.reason}`);
    }
  }
  for (const g of agg.gaps) console.log(dim(`  ⚠ ${g}`));

  console.log("\n" + bold("  Findings") + dim(" (ranked by estimated cost)"));
  let n = 0;
  for (const f of findings) {
    n++;
    const tag = f.overlaps.length ? dim(" [overlaps: " + f.overlaps.join(", ") + "]") : "";
    const money = f.cost > 0 ? bold(usd(f.cost)) : dim("no $ claimed");
    console.log(`\n  ${n}. ${bold(f.title)}  ${money}${tag}`);
    console.log(wrap(f.headline, 84, "     "));
    console.log(dim(wrap(f.detail, 84, "     ")));
    if (f.table?.length) console.log("\n" + table(f.table.slice(0, opt.top)).split("\n").map((l) => "   " + l).join("\n"));
    if (f.builtin) console.log(dim(`\n     cross-check: ${f.builtin}`));
    if (f.fix?.summary) {
      console.log("\n     " + dim("fix: ") + f.fix.summary);
      for (const a of f.fix.actions || []) console.log(dim("       • " + a));
    }
  }

  if (skipped.length) {
    console.log("\n" + bold("  Not evaluated") + dim(" (stated rather than reported as zero)"));
    for (const s of skipped) console.log(dim(`    ${s.id}: ${s.reason}`));
  }
}

async function main() {
  const opt = parseArgs(process.argv);
  const pricing = await loadPricing(opt.pricing);
  const defs = await loadSourceDefs();
  const detected = await detectSources(defs);

  if (opt.list) {
    for (const d of detected) {
      console.log(`${d.def.name.padEnd(18)} ${String(d.files.length).padStart(5)} files  ${d.root}` +
        (d.def.status === "unverified" ? "  [unverified mapping]" : ""));
    }
    const missing = defs.filter((x) => !detected.some((d) => d.def.name === x.name));
    for (const m of missing) console.log(dim(`${m.name.padEnd(18)}, not installed`));
    return;
  }

  let targets = detected.filter((d) => d.files.length);
  if (opt.source !== "auto" && opt.source !== "all") {
    targets = detected.filter((d) => d.def.name === opt.source);
    if (!targets.length) throw new Error(`source "${opt.source}" not found or has no logs (try --list-sources)`);
  }
  if (!targets.length) {
    console.log("No agent logs found on this machine. Run with --list-sources to see what was checked.");
    return;
  }

  const results = [];
  const insights = await loadInsights();
  for (const t of targets) results.push(await auditSource(t, opt, pricing, insights));

  if (opt.json) {
    console.log(JSON.stringify({
      generated_at: new Date().toISOString(),
      disclaimer: "Estimated from local logs and published list prices. Not a bill.",
      sources: results.map((r) => ({
        source: r.def.name, status: r.def.status ?? "verified", stats: r.stats,
        window: r.agg.window, total_cost_usd: r.agg.totalCost, addressable_usd: r.addressable,
        sessions: r.agg.sessions.size, turns: r.agg.totalTurns,
        by_model: Object.fromEntries(r.agg.byModel),
        unpriced: Object.fromEntries(r.agg.unpriced),
        gaps: [...r.agg.gaps],
        findings: r.findings.map(({ id, title, cost, estimate, headline, detail, table, fix, overlaps, builtin }) =>
          ({ id, title, cost_usd: cost, estimate, headline, detail, table, fix, overlaps, builtin })),
        skipped: r.skipped,
      })),
    }, null, 2));
    return;
  }

  for (const r of results) report(r, opt);
  if (results.some((r) => r.def.name === "claude-code")) reportBuiltins(await builtinsStatus(), results.find((r) => r.join)?.join);
  console.log("\n" + dim("  Dollar figures are API list-price equivalents, not a bill." +
    "\n  Next: node scripts/benchmark.mjs snapshot --label before   (then apply fixes, then verify)\n"));
}

main().catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
