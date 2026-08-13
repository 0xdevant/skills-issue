#!/usr/bin/env node
/**
 * Test suite. Zero dependencies, run with: node test/run.mjs
 *
 * Each test builds a real temp log tree and drives the real code paths — there are
 * no mocks, because the failure mode that matters here is "the mapping silently
 * matched nothing", which a mock would hide.
 */

import { mkdtemp, mkdir, writeFile, rm, readFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { loadPricing, costRecord, resolveModel } from "../scripts/lib/cost.mjs";
import { readSource, loadSourceDefs, getPath, canonicalRecord, parseSince } from "../scripts/lib/sources.mjs";
import { createAggregator } from "../scripts/lib/aggregate.mjs";
import { runFindings } from "../scripts/lib/findings.mjs";

let passed = 0, failed = 0;
const results = [];

function check(name, cond, detail = "") {
  if (cond) { passed++; results.push(`  ✓ ${name}`); }
  else { failed++; results.push(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); }
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

async function tmp() {
  return mkdtemp(join(tmpdir(), "ata-test-"));
}

// ---------------------------------------------------------------- fixtures

const cc = (over = {}) => JSON.stringify({
  type: "assistant", timestamp: "2026-08-01T10:00:00.000Z", sessionId: "s1", cwd: "/proj",
  message: {
    id: over.id || "msg_1", model: over.model || "claude-opus-5",
    usage: {
      input_tokens: 10, output_tokens: 100,
      cache_read_input_tokens: over.read ?? 50_000,
      cache_creation: { ephemeral_5m_input_tokens: over.w5m ?? 1000, ephemeral_1h_input_tokens: over.w1h ?? 0 },
      // Present on real data and a classic double-count trap: the top level already totals this.
      iterations: [{ input_tokens: 10, output_tokens: 100, cache_read_input_tokens: over.read ?? 50_000 }],
    },
  },
});

async function claudeTree(lines) {
  const root = await tmp();
  await mkdir(join(root, "projects", "p1"), { recursive: true });
  await writeFile(join(root, "projects", "p1", "s1.jsonl"), lines.join("\n") + "\n");
  return root;
}

async function runClaudeSource(root, defs) {
  const def = defs.find((d) => d.name === "claude-code");
  const detected = { def, root, files: [join(root, "projects", "p1", "s1.jsonl")] };
  const recs = [], evs = [];
  const stats = await readSource(detected, { onRecord: (r) => recs.push(r), onEvent: (e) => evs.push(e) });
  return { recs, evs, stats, def };
}

// ---------------------------------------------------------------- tests

async function main() {
  const pricing = await loadPricing();
  const defs = await loadSourceDefs();

  // --- pricing / cost -------------------------------------------------

  {
    const r = resolveModel(pricing, "claude-haiku-4-5-20251001");
    check("model id with date suffix resolves", !r.unpriced && r.provider === "anthropic",
      `got ${JSON.stringify(r)}`);
  }
  {
    // Longest-prefix wins: gpt-5.4-mini must not fall back to the cheaper gpt-5.
    const r = resolveModel(pricing, "gpt-5.4-mini-2026-01-01");
    check("longest-prefix model match", !r.unpriced && near(r.rates.input, 0.75),
      `got input rate ${r.rates?.input}`);
  }
  {
    const r = resolveModel(pricing, "some-model-nobody-has-heard-of");
    check("unknown model is unpriced, not zero-cost", r.unpriced === true);
    const c = costRecord(pricing, { ...canonicalRecord(), model: "some-model-nobody-has-heard-of", input_tokens: 1e6 });
    check("unpriced model reports its tokens rather than $0 silently",
      c.unpriced === true && c.unpricedTokens === 1e6 && c.total === 0);
  }
  {
    // Anthropic: explicit write TTL pricing. Opus 5 = $5 in / $25 out / $0.50 read /
    // $6.25 5m-write / $10 1h-write per MTok.
    const rec = { ...canonicalRecord(), model: "claude-opus-5", input_tokens: 1e6, output_tokens: 1e6,
      cache_read_tokens: 1e6, cache_write_tokens: { "5m": 1e6, "1h": 1e6, default: 0 } };
    const c = costRecord(pricing, rec);
    check("anthropic cost math", near(c.input, 5) && near(c.output, 25) && near(c.cache_read, 0.5) && near(c.cache_write, 16.25),
      `input=${c.input} output=${c.output} read=${c.cache_read} write=${c.cache_write}`);
  }
  {
    // OpenAI: discounted read, NO write charge. Writing 1M cache tokens must cost $0.
    const rec = { ...canonicalRecord(), model: "gpt-5", input_tokens: 1e6, cache_read_tokens: 1e6,
      cache_write_tokens: { "5m": 1e6, "1h": 1e6, default: 1e6 } };
    const c = costRecord(pricing, rec);
    check("openai cache model charges no write premium",
      near(c.input, 1.25) && near(c.cache_read, 0.125) && near(c.cache_write, 0),
      `read=${c.cache_read} write=${c.cache_write}`);
  }
  {
    // Google: cache storage is billed per hour and the logs do not record lifetime.
    const rec = { ...canonicalRecord(), model: "gemini-2.5-pro", input_tokens: 1e6, cache_read_tokens: 1e6 };
    const c = costRecord(pricing, rec);
    check("google storage cost is declared as a gap, not guessed",
      c.gaps.some((g) => /cache storage/i.test(g)), JSON.stringify(c.gaps));
  }
  {
    const rec = { ...canonicalRecord(), model: "llama3.1", input_tokens: 1e9, output_tokens: 1e9 };
    const c = costRecord(pricing, rec);
    check("local models cost zero but still resolve", !c.unpriced && near(c.total, 0));
  }

  // --- path engine ----------------------------------------------------

  {
    const obj = { message: { content: [{ type: "text" }, { type: "thinking" }, { type: "tool_use", name: "Bash", id: "t1" }] } };
    check("array-search path finds a block behind other blocks",
      getPath(obj, "message.content[type=tool_use].name") === "Bash");
    check("array-search path returns undefined when absent",
      getPath(obj, "message.content[type=image].name") === undefined);
  }

  // --- claude-code mapping --------------------------------------------

  {
    const root = await claudeTree([cc({ id: "a" }), cc({ id: "a" }), cc({ id: "b" })]);
    const { recs, stats } = await runClaudeSource(root, defs);
    check("duplicate message.id is deduped", recs.length === 2 && stats.deduped === 1,
      `records=${recs.length} deduped=${stats.deduped}`);
    await rm(root, { recursive: true, force: true });
  }
  {
    const root = await claudeTree([cc({ id: "a" }), cc({ id: "b", model: "<synthetic>" })]);
    const { recs } = await runClaudeSource(root, defs);
    check("<synthetic> entries excluded", recs.length === 1 && recs[0].model === "claude-opus-5");
    await rm(root, { recursive: true, force: true });
  }
  {
    const root = await claudeTree([cc({ id: "a" }), "{not json", "", cc({ id: "b" })]);
    const { recs, stats } = await runClaudeSource(root, defs);
    check("malformed lines skipped and counted", recs.length === 2 && stats.malformed === 1,
      `malformed=${stats.malformed}`);
    await rm(root, { recursive: true, force: true });
  }
  {
    // The iterations[] double-count trap: one record with read=50k must stay 50k.
    const root = await claudeTree([cc({ id: "a", read: 50_000 })]);
    const { recs } = await runClaudeSource(root, defs);
    check("usage.iterations[] is not double-counted", recs[0].cache_read_tokens === 50_000,
      `got ${recs[0].cache_read_tokens}`);
    await rm(root, { recursive: true, force: true });
  }
  {
    const compaction = JSON.stringify({
      type: "system", subtype: "compact_boundary", timestamp: "2026-08-01T10:05:00.000Z", sessionId: "s1",
      compactMetadata: { trigger: "auto", preTokens: 380000, postTokens: 67000, cumulativeDroppedTokens: 313000 },
    });
    const subagent = JSON.stringify({
      type: "user", timestamp: "2026-08-01T10:06:00.000Z", sessionId: "s1",
      toolUseResult: { agentType: "Explore", resolvedModel: "claude-sonnet-5", totalTokens: 31933,
        totalToolUseCount: 8, totalDurationMs: 81203, content: "x".repeat(500),
        usage: { input_tokens: 1, output_tokens: 2340, cache_read_input_tokens: 28788 } },
    });
    const root = await claudeTree([cc({ id: "a" }), compaction, subagent]);
    const { evs } = await runClaudeSource(root, defs);
    const comp = evs.find((e) => e.kind === "compaction");
    const sub = evs.find((e) => e.kind === "subagent");
    check("compaction event parsed", comp?.trigger === "auto" && comp.pre_tokens === 380000);
    check("subagent spend recovered from toolUseResult (not isSidechain)",
      sub?.agent_type === "Explore" && sub.total_tokens === 31933 && sub.tool_uses === 8);
    await rm(root, { recursive: true, force: true });
  }

  // --- openai-generic mapping -----------------------------------------

  {
    const root = await tmp();
    await writeFile(join(root, "log.jsonl"), [
      JSON.stringify({ id: "r1", model: "gpt-5", created_at: "2026-08-01T10:00:00Z",
        usage: { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 800 } } }),
      JSON.stringify({ id: "r2", model: "gpt-4.1", timestamp: "2026-08-01T10:01:00Z",
        usage: { prompt_tokens: 500, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 400 } } }),
    ].join("\n"));
    const def = defs.find((d) => d.name === "openai-generic");
    const recs = [];
    await readSource({ def, root, files: [join(root, "log.jsonl")] }, { onRecord: (r) => recs.push(r) });
    check("openai-shaped logs map to the canonical record", recs.length === 2 &&
      recs[0].cache_read_tokens === 800 && recs[1].input_tokens === 500 && recs[1].cache_read_tokens === 400,
      JSON.stringify(recs));
    check("provider_hint applied for non-anthropic source", recs[0].provider === "openai");
    await rm(root, { recursive: true, force: true });
  }

  // --- capability gating ----------------------------------------------

  {
    const agg = createAggregator(pricing);
    agg.record({ ...canonicalRecord(), model: "gpt-5", session_id: "x", ts: "2026-08-01T10:00:00Z",
      input_tokens: 1000, output_tokens: 100, cache_read_tokens: 500_000 });
    const a = agg.finalize();

    const withCache = runFindings(a, { pricing, capabilities: ["cache"], sourceName: "t", top: 5,
      targetContext: 120_000, longSessionTurns: 150, bigToolOutputTokens: 5_000, redundantReadThreshold: 3 });
    const without = runFindings(a, { pricing, capabilities: [], sourceName: "t", top: 5,
      targetContext: 120_000, longSessionTurns: 150, bigToolOutputTokens: 5_000, redundantReadThreshold: 3 });

    check("cache findings run when the source declares the capability",
      withCache.findings.some((f) => f.id === "context-bloat"));
    check("cache findings are SKIPPED WITH A REASON when it does not",
      !without.findings.some((f) => f.id === "context-bloat") &&
      without.skipped.some((s) => s.id === "context-bloat" && /does not record/.test(s.reason)),
      JSON.stringify(without.skipped.find((s) => s.id === "context-bloat")));
    check("compaction finding skipped for a source without the capability",
      without.skipped.some((s) => s.id === "compaction-pressure"));
  }

  // --- no double counting ---------------------------------------------

  {
    const agg = createAggregator(pricing);
    for (let i = 0; i < 300; i++) {
      agg.record({ ...canonicalRecord(), model: "claude-opus-5", session_id: "big",
        ts: new Date(Date.parse("2026-08-01T10:00:00Z") + i * 60000).toISOString(),
        input_tokens: 5, output_tokens: 200, cache_read_tokens: 500_000,
        cache_write_tokens: { "5m": 2000, "1h": 0, default: 0 } });
    }
    for (let i = 0; i < 50; i++) {
      agg.event({ kind: "tool_result", session_id: "big", bytes: 200_000, tokens: 50_000,
        target: `/f${i}.txt`, ts: "2026-08-01T10:05:00Z" });
    }
    // Same file read repeatedly -> exercises the redundant-reads finding.
    for (let i = 0; i < 4; i++) {
      agg.event({ kind: "tool_result", session_id: "big", bytes: 40_000, tokens: 10_000,
        target: "/repeated.ts", ts: "2026-08-01T10:06:00Z" });
    }
    const a = agg.finalize();
    const { findings, addressable } = runFindings(a, { pricing, capabilities: ["cache", "tool_results"],
      sourceName: "t", top: 5, targetContext: 120_000, longSessionTurns: 150,
      bigToolOutputTokens: 5_000, redundantReadThreshold: 3 });

    check("addressable never exceeds total spend", addressable <= a.totalCost + 1e-9,
      `addressable=${addressable} total=${a.totalCost}`);
    for (const f of findings) {
      if (["context-bloat", "tool-output-waste", "session-start-overhead", "redundant-reads"].includes(f.id)) {
        check(`${f.id} capped at the measured cache-read pool`, f.cost <= a.cacheReadCost + 1e-9,
          `finding=${f.cost} pool=${a.cacheReadCost}`);
      }
    }
    // Regression guard: a finding must never emit NaN. A missing field silently
    // becomes NaN in arithmetic, which renders as "no $ claimed" and looks like a
    // legitimate result rather than a bug.
    for (const f of findings) {
      check(`${f.id} cost is a finite number`, Number.isFinite(f.cost), `cost=${f.cost}`);
      const bad = (f.table || []).flatMap((row) =>
        Object.entries(row).filter(([, v]) => typeof v === "number" ? !Number.isFinite(v) : String(v) === "NaN")
      );
      check(`${f.id} table has no NaN cells`, bad.length === 0, JSON.stringify(bad));
    }

    const overlapping = findings.filter((f) => f.overlaps.length).map((f) => f.id);
    check("decomposition findings are marked as overlapping",
      overlapping.includes("tool-output-waste") && overlapping.includes("session-start-overhead"),
      `overlapping=${overlapping.join(",")}`);
  }

  // --- image results priced by pixels, not payload size ----------------

  {
    const root = await tmp();
    await mkdir(join(root, "projects", "p1"), { recursive: true });
    // A 1000x1000 image is ~1333 tokens. Its base64 payload is ~600k chars, which
    // as text would read as ~150k tokens — a 100x overstatement.
    const imgEntry = JSON.stringify({
      type: "user", timestamp: "2026-08-01T10:00:00.000Z", sessionId: "s1",
      message: { content: [{ type: "tool_result", tool_use_id: "t1" }] },
      toolUseResult: {
        type: "image",
        file: { type: "image/png", base64: "A".repeat(600_000),
                dimensions: { originalWidth: 2000, originalHeight: 2000, displayWidth: 1000, displayHeight: 1000 } },
      },
    });
    await writeFile(join(root, "projects", "p1", "s1.jsonl"), cc({ id: "a" }) + "\n" + imgEntry + "\n");
    const { evs } = await runClaudeSource(root, defs);
    const tr = evs.find((e) => e.kind === "tool_result");
    check("image result priced by display pixels, not base64 length",
      tr && Math.abs(tr.tokens - Math.round(1000 * 1000 / 750)) <= 1,
      `tokens=${tr?.tokens} bytes=${tr?.bytes}`);
    check("image byte size still recorded separately", tr && tr.bytes > 500_000);
    check("image token estimate is far below the naive text estimate",
      tr && tr.tokens < tr.bytes / 4 / 50, `tokens=${tr?.tokens} naive=${tr && tr.bytes / 4}`);
    await rm(root, { recursive: true, force: true });
  }

  {
    // Non-image results must still use the text estimate.
    const root = await tmp();
    await mkdir(join(root, "projects", "p1"), { recursive: true });
    const textEntry = JSON.stringify({
      type: "user", timestamp: "2026-08-01T10:00:00.000Z", sessionId: "s1",
      message: { content: [{ type: "tool_result", tool_use_id: "t2" }] },
      toolUseResult: { stdout: "x".repeat(40_000), stderr: "" },
    });
    await writeFile(join(root, "projects", "p1", "s1.jsonl"), textEntry + "\n");
    const { evs } = await runClaudeSource(root, defs);
    const tr = evs.find((e) => e.kind === "tool_result");
    check("text result still estimated at ~4 bytes/token",
      tr && Math.abs(tr.tokens - tr.bytes / 4) <= 2, `tokens=${tr?.tokens} bytes=${tr?.bytes}`);
    await rm(root, { recursive: true, force: true });
  }

  // --- since parsing ---------------------------------------------------

  {
    const iso = parseSince("7d");
    const delta = Date.now() - new Date(iso).getTime();
    check("--since 7d parses to ~7 days ago", Math.abs(delta - 7 * 86400e3) < 5000);
    let threw = false;
    try { parseSince("not-a-date"); } catch { threw = true; }
    check("--since rejects garbage rather than silently defaulting", threw);
  }

  // --- empty / missing data -------------------------------------------

  {
    const root = await tmp();
    const def = defs.find((d) => d.name === "claude-code");
    const stats = await readSource({ def, root, files: [] }, { onRecord: () => {}, onEvent: () => {} });
    check("empty source yields zero records without throwing", stats.records === 0 && stats.files === 0);
    await rm(root, { recursive: true, force: true });
  }

  // --- backup round trip ----------------------------------------------

  {
    const root = await tmp();
    const f = join(root, "settings.json");
    const original = JSON.stringify({ a: 1, nested: { b: [1, 2, 3] } }, null, 2) + "\n";
    await writeFile(f, original);
    const digest = (s) => createHash("sha256").update(s).digest("hex");
    const before = digest(await readFile(f, "utf8"));

    const bak = join(root, "settings.json.bak");
    await copyFile(f, bak);
    await writeFile(f, "MUTATED");
    await copyFile(bak, f);

    check("backup restores byte-identically", digest(await readFile(f, "utf8")) === before);
    await rm(root, { recursive: true, force: true });
  }

  // ----------------------------------------------------------------

  console.log("\n" + results.join("\n"));
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
