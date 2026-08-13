#!/usr/bin/env node
/**
 * token-usage-audit — benchmark
 *
 * The naive way to answer "did this save money" is to compare total spend before
 * and after. That number is dominated by what you happened to work on, so it looks
 * authoritative and means nothing. This tool refuses to produce it.
 *
 * Instead there are two classes, reported separately and never blended:
 *
 *   CLASS A — attributable. Derived from the configuration fingerprint, not from
 *   usage. Deterministic: shrink the resident prefix by N tokens and every future
 *   turn reads N fewer tokens. `verify` checks the prediction against a real
 *   measured cache write from a session that started after the change.
 *
 *   CLASS B — observational. Normalized ratios over equal-length windows. Always
 *   confounded by workload; labelled as such; never the headline.
 */

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

import { loadPricing, usd, cacheReadRate } from "./lib/cost.mjs";
import { loadSourceDefs, detectSources, readSource, parseSince, expandPath } from "./lib/sources.mjs";
import { createAggregator } from "./lib/aggregate.mjs";
import { fingerprint, diffFingerprints } from "./lib/fingerprint.mjs";

const STATE_DIR = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "token-usage-audit");
const BASELINE_DIR = join(STATE_DIR, "baselines");

const HELP = `
token-usage-audit — benchmark

  node scripts/benchmark.mjs snapshot [--label before] [--source <name>]
  node scripts/benchmark.mjs compare  [--before latest|<file>] [--window 7d]
  node scripts/benchmark.mjs verify   [--before latest|<file>]
  node scripts/benchmark.mjs list

  snapshot   record the config fingerprint + normalized usage metrics
  compare    Class A (attributable) and Class B (observational) deltas, kept apart
  verify     check the Class A prediction against real post-change sessions
  list       show stored baselines

Options: --json, --pricing <file>, --help
`;

const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const kt = (n) => `${(n / 1000).toFixed(1)}k`;
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------------------------------------------------------------- metrics

/** Normalized, workload-resistant ratios. Class B only. */
async function observational(detected, pricing, since) {
  const agg = createAggregator(pricing);
  await readSource(detected, { since, onRecord: (r) => agg.record(r), onEvent: (e) => agg.event(e) });
  const a = agg.finalize();

  const sessions = [...a.sessions.values()].filter((s) => s.turns > 0);
  const ctxAll = sessions.flatMap((s) => s.ctx);

  return {
    window_from: a.window.from ? new Date(a.window.from).toISOString() : null,
    window_to: a.window.to ? new Date(a.window.to).toISOString() : null,
    sessions: sessions.length,
    turns: a.totalTurns,
    total_cost_usd: a.totalCost,
    median_context_per_turn: median(ctxAll),
    median_turns_per_session: median(sessions.map((s) => s.turns)),
    median_session_start_tokens: median(sessions.map((s) => s.firstWrite).filter(Boolean)),
    cost_per_turn: a.totalTurns ? a.totalCost / a.totalTurns : 0,
    cost_per_session: sessions.length ? a.totalCost / sessions.length : 0,
    compactions_per_session: sessions.length ? a.compactions.length / sessions.length : 0,
    // Workload-similarity signals: without these the Class B deltas are uninterpretable.
    workload: {
      distinct_projects: new Set(sessions.map((s) => s.project)).size,
      tools_used: a.toolsUsed.size,
      subagent_calls: a.subagents.length,
      model_mix: Object.fromEntries([...a.byModel].map(([m, v]) => [m, v.turns])),
    },
    dominant_model: a.dominantModel,
  };
}

/** Class A projection: what a resident-prefix delta is worth over a usage window. */
function projectSaving(deltaTokens, obs, pricing) {
  const rate = cacheReadRate(pricing, obs.dominant_model);
  if (rate == null || !deltaTokens) return null;
  // Every turn re-reads the prefix; the write is paid once per session.
  const readSaving = -deltaTokens * obs.turns * rate;
  const writeSaving = -deltaTokens * obs.sessions * rate * 12.5; // write ≈ 12.5x read rate
  return {
    per_turn_tokens: -deltaTokens,
    read_saving_usd: readSaving,
    write_saving_usd: writeSaving,
    total_usd: readSaving + writeSaving,
    basis: `${obs.turns} turns / ${obs.sessions} sessions in the measured window`,
  };
}

// ---------------------------------------------------------------- storage

async function saveBaseline(data) {
  await mkdir(BASELINE_DIR, { recursive: true });
  const name = `${data.taken_at.replace(/[:.]/g, "-")}-${data.label}.json`;
  const path = join(BASELINE_DIR, name);
  await writeFile(path, JSON.stringify(data, null, 2));
  return path;
}

async function listBaselines() {
  try {
    const files = (await readdir(BASELINE_DIR)).filter((f) => f.endsWith(".json")).sort();
    return files.map((f) => join(BASELINE_DIR, f));
  } catch { return []; }
}

async function loadBaseline(ref) {
  if (!ref || ref === "latest") {
    const all = await listBaselines();
    if (!all.length) throw new Error("no baselines stored — run `benchmark.mjs snapshot --label before` first");
    return JSON.parse(await readFile(all[all.length - 1], "utf8"));
  }
  return JSON.parse(await readFile(expandPath(ref) || ref, "utf8"));
}

// ---------------------------------------------------------------- commands

async function pickSource(name) {
  const defs = await loadSourceDefs();
  const detected = (await detectSources(defs)).filter((d) => d.files.length);
  if (!detected.length) throw new Error("no agent logs found on this machine");
  if (name) {
    const hit = detected.find((d) => d.def.name === name);
    if (!hit) throw new Error(`source "${name}" has no logs`);
    return hit;
  }
  return detected.sort((a, b) => b.files.length - a.files.length)[0];
}

async function cmdSnapshot(opt) {
  const pricing = await loadPricing(opt.pricing);
  const src = await pickSource(opt.source);
  const obs = await observational(src, pricing, parseSince(opt.window || "14d"));
  const fp = await fingerprint(src.def);

  const data = {
    schema: 1,
    label: opt.label || "baseline",
    taken_at: new Date().toISOString(),
    source: src.def.name,
    fingerprint: fp,
    observational: obs,
  };
  const path = await saveBaseline(data);

  if (opt.json) return console.log(JSON.stringify(data, null, 2));

  console.log(`\n${bold("Baseline recorded")}  ${dim(path)}\n`);
  if (fp.supported) {
    console.log(bold("  Class A — resident prefix (attributable, confound-free)"));
    console.log(`    total resident        ${kt(fp.total_tokens)} tokens (est.)`);
    for (const [label, v] of Object.entries(fp.by_label)) {
      console.log(`      ${label.padEnd(20)} ${String(v.files).padStart(3)} files  ${kt(v.tokens).padStart(7)}`);
    }
    if (fp.mcp_servers.length) console.log(`      ${"mcp servers".padEnd(20)} ${fp.mcp_servers.join(", ")}`);
    console.log(dim("\n    Largest resident files:"));
    for (const f of fp.files.slice(0, 8)) {
      console.log(dim(`      ${kt(f.tokens).padStart(7)}  ${f.name}  ${f.path.replace(homedir(), "~")}`));
    }
  } else {
    console.log(dim(`  Class A unavailable: ${fp.reason}`));
  }

  console.log("\n" + bold("  Class B — normalized usage (workload-confounded)"));
  console.log(`    median context/turn   ${kt(obs.median_context_per_turn)}`);
  console.log(`    median turns/session  ${obs.median_turns_per_session}`);
  console.log(`    cost/turn             ${usd(obs.cost_per_turn)}`);
  console.log(`    cost/session          ${usd(obs.cost_per_session)}`);
  console.log(`    compactions/session   ${obs.compactions_per_session.toFixed(2)}`);
  console.log(dim(`\n  Next: apply your fixes, then \`benchmark.mjs verify\` after one new session.`));
}

async function cmdCompare(opt) {
  const pricing = await loadPricing(opt.pricing);
  const before = await loadBaseline(opt.before);
  const src = await pickSource(before.source);

  // Equal-length windows: the "after" window matches the baseline's span.
  const afterObs = await observational(src, pricing, before.taken_at);
  const afterFp = await fingerprint(src.def);
  const fpDiff = diffFingerprints(before.fingerprint, afterFp);

  if (opt.json) {
    return console.log(JSON.stringify({ before_label: before.label, class_a: fpDiff, class_b: { before: before.observational, after: afterObs } }, null, 2));
  }

  console.log(`\n${bold("Comparison")}  ${dim(`baseline "${before.label}" taken ${before.taken_at}`)}\n`);

  console.log(bold("  ══ CLASS A — attributable ══") + dim("  deterministic; not affected by what you worked on"));
  if (!fpDiff.supported) {
    console.log(dim("    unavailable for this source"));
  } else if (!fpDiff.delta_tokens) {
    console.log("    Resident prefix unchanged — no attributable saving to claim.");
  } else {
    const dir = fpDiff.delta_tokens < 0 ? "smaller" : "LARGER";
    console.log(`    Resident prefix ${kt(before.fingerprint.total_tokens)} → ${kt(fpDiff.after_tokens)} tokens (${dir} by ${kt(Math.abs(fpDiff.delta_tokens))})`);
    const proj = projectSaving(fpDiff.delta_tokens, afterObs, pricing);
    if (proj) {
      console.log(`    Projected effect: ${usd(proj.total_usd)} over ${proj.basis}`);
      console.log(dim(`      cache reads ${usd(proj.read_saving_usd)} + cache writes ${usd(proj.write_saving_usd)}`));
    }
    console.log(dim("\n    Changed files:"));
    for (const c of fpDiff.changes.slice(0, 10)) {
      console.log(dim(`      ${(c.delta > 0 ? "+" : "") + c.delta} tok  ${c.kind.padEnd(8)} ${c.name}`));
    }
    console.log(dim("\n    Run `verify` to check this prediction against a real measured session."));
  }

  console.log("\n" + bold("  ══ CLASS B — observational ══") + dim("  CONFOUNDED by workload — read as a trend, not a saving"));
  const b = before.observational, a = afterObs;
  const row = (label, bv, av, fmt = (x) => x.toFixed(0)) => {
    const delta = av - bv;
    const pctv = bv ? ((delta / bv) * 100).toFixed(0) : "—";
    console.log(`    ${label.padEnd(24)} ${fmt(bv).padStart(10)} → ${fmt(av).padStart(10)}   ${(delta > 0 ? "+" : "") + pctv}%`);
  };
  row("median context/turn", b.median_context_per_turn, a.median_context_per_turn, kt);
  row("median turns/session", b.median_turns_per_session, a.median_turns_per_session);
  row("cost/turn", b.cost_per_turn, a.cost_per_turn, usd);
  row("cost/session", b.cost_per_session, a.cost_per_session, usd);
  row("compactions/session", b.compactions_per_session, a.compactions_per_session, (x) => x.toFixed(2));

  console.log("\n" + dim("    Workload comparability:"));
  console.log(dim(`      turns          ${b.turns} → ${a.turns}`));
  console.log(dim(`      projects       ${b.workload.distinct_projects} → ${a.workload.distinct_projects}`));
  console.log(dim(`      subagent calls ${b.workload.subagent_calls} → ${a.workload.subagent_calls}`));
  const ratio = b.turns ? a.turns / b.turns : 0;
  if (ratio < 0.5 || ratio > 2) {
    console.log(`\n    ${bold("⚠")} Window sizes differ by more than 2x. These Class B deltas are not comparable.`);
  }
  console.log("\n" + dim("  No headline saving is reported from Class B alone — by design.\n"));
}

async function cmdVerify(opt) {
  const pricing = await loadPricing(opt.pricing);
  const before = await loadBaseline(opt.before);
  const src = await pickSource(before.source);

  const afterFp = await fingerprint(src.def);
  const fpDiff = diffFingerprints(before.fingerprint, afterFp);

  // Only sessions that STARTED after the baseline can reflect the change.
  const agg = createAggregator(pricing);
  await readSource(src, { since: before.taken_at, onRecord: (r) => agg.record(r), onEvent: (e) => agg.event(e) });
  const a = agg.finalize();
  const newSessions = [...a.sessions.values()].filter((s) => s.firstWrite > 0);

  const predictedTokens = (before.observational.median_session_start_tokens || 0) + (fpDiff.supported ? fpDiff.delta_tokens : 0);
  const measured = median(newSessions.map((s) => s.firstWrite));

  const out = {
    baseline_label: before.label,
    baseline_start_tokens: before.observational.median_session_start_tokens,
    fingerprint_delta_tokens: fpDiff.supported ? fpDiff.delta_tokens : null,
    predicted_start_tokens: predictedTokens,
    measured_start_tokens: measured,
    sessions_measured: newSessions.length,
    error_tokens: measured ? measured - predictedTokens : null,
    error_pct: measured && predictedTokens ? ((measured - predictedTokens) / predictedTokens) * 100 : null,
  };

  if (opt.json) return console.log(JSON.stringify(out, null, 2));

  console.log(`\n${bold("Verification")} ${dim(`against baseline "${before.label}"`)}\n`);
  if (!newSessions.length) {
    console.log("  No sessions have started since the baseline was taken.");
    console.log(dim("  Start a new session, do some work, then run verify again.\n"));
    return;
  }
  console.log(`  Baseline session start      ${kt(out.baseline_start_tokens || 0)} tokens`);
  console.log(`  Fingerprint change          ${out.fingerprint_delta_tokens > 0 ? "+" : ""}${out.fingerprint_delta_tokens ?? "n/a"} tokens`);
  console.log(`  ${bold("Predicted")} session start     ${kt(predictedTokens)} tokens`);
  console.log(`  ${bold("Measured")} session start      ${kt(measured)} tokens   ${dim(`(median of ${newSessions.length} new sessions)`)}`);
  console.log(`\n  Prediction error            ${out.error_tokens > 0 ? "+" : ""}${out.error_tokens} tokens (${out.error_pct?.toFixed(0)}%)`);

  const absPct = Math.abs(out.error_pct ?? 0);
  if (absPct <= 15) {
    console.log(`\n  ${bold("✓")} Measurement confirms the projection within 15%.`);
  } else {
    console.log(`\n  ${bold("✗")} Measurement diverges from the projection by ${absPct.toFixed(0)}%.`);
    console.log(dim("    The resident prefix contains more than the files on disk — MCP tool schemas and"));
    console.log(dim("    the harness's own system prompt are counted here but not in the fingerprint."));
    console.log(dim("    Treat the MEASURED number as truth; the fingerprint is the estimate."));
  }
  console.log("");
}

async function cmdList() {
  const all = await listBaselines();
  if (!all.length) return console.log("no baselines stored");
  for (const p of all) {
    const b = JSON.parse(await readFile(p, "utf8"));
    console.log(`${b.taken_at}  ${b.label.padEnd(12)} ${b.source.padEnd(14)} ` +
      `resident=${b.fingerprint?.supported ? kt(b.fingerprint.total_tokens) : "n/a"}  ${dim(p)}`);
  }
}

// ----------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "--help" || cmd === "-h") { console.log(HELP); return; }

  const opt = { json: false };
  for (let i = 1; i < argv.length; i++) {
    const next = () => argv[++i];
    switch (argv[i]) {
      case "--label": opt.label = next(); break;
      case "--source": opt.source = next(); break;
      case "--before": opt.before = next(); break;
      case "--window": opt.window = next(); break;
      case "--pricing": opt.pricing = next(); break;
      case "--json": opt.json = true; break;
      default: throw new Error(`unknown option: ${argv[i]}`);
    }
  }

  switch (cmd) {
    case "snapshot": return cmdSnapshot(opt);
    case "compare": return cmdCompare(opt);
    case "verify": return cmdVerify(opt);
    case "list": return cmdList();
    default: throw new Error(`unknown command "${cmd}" (try --help)`);
  }
}

main().catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
