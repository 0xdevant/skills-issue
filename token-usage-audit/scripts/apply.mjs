#!/usr/bin/env node
/**
 * token-usage-audit — apply
 *
 * Fixes are split by reversibility, not by convenience:
 *   SAFE   — additive, self-contained, undone by deleting a key. Applied on request.
 *   RISKY  — edits content you wrote, or changes what the agent can reach. Requires
 *            --confirm and always prints the diff first.
 *
 * Every write is backed up first and `undo` restores byte-identically. Fixes that
 * cannot be automated at all are reported as a written plan rather than silently
 * dropped, because a behavioural fix you never see is not a fix.
 */

import { readFile, writeFile, mkdir, readdir, copyFile, stat, chmod } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

import { loadPricing, usd } from "./lib/cost.mjs";
import { loadSourceDefs, detectSources, readSource, parseSince, expandPath } from "./lib/sources.mjs";
import { createAggregator } from "./lib/aggregate.mjs";
import { fingerprint } from "./lib/fingerprint.mjs";

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const STATE_DIR = join(CONFIG_DIR, "token-usage-audit");
const BACKUP_DIR = join(STATE_DIR, "backups");

const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s) => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s);

const HELP = `
token-usage-audit — apply

  node scripts/apply.mjs list                    what can be fixed, and how risky
  node scripts/apply.mjs apply <id> [--confirm]  apply a fix (risky ones need --confirm)
  node scripts/apply.mjs plan                    the manual action plan (nothing automatable)
  node scripts/apply.mjs undo <id|latest>        restore from backup, byte-identically
  node scripts/apply.mjs backups                 list restore points

Options: --dry-run (print the diff, write nothing), --json, --help
`;

// ---------------------------------------------------------------- backup / restore

async function readIfExists(p) {
  try { return await readFile(p, "utf8"); } catch { return null; }
}

const sha = (s) => createHash("sha256").update(s ?? "").digest("hex").slice(0, 12);

async function backup(fixId, paths) {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${fixId}`;
  const dir = join(BACKUP_DIR, id);
  await mkdir(dir, { recursive: true });
  const manifest = { id, fix: fixId, created_at: new Date().toISOString(), files: [] };

  for (const p of paths) {
    const content = await readIfExists(p);
    const stored = join(dir, basename(p) + "." + sha(p));
    if (content !== null) await writeFile(stored, content);
    manifest.files.push({ path: p, stored: content === null ? null : stored, existed: content !== null, sha: sha(content) });
  }
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

async function restore(id) {
  let target = id;
  if (id === "latest") {
    const all = (await readdir(BACKUP_DIR).catch(() => [])).sort();
    if (!all.length) throw new Error("no backups to restore");
    target = all[all.length - 1];
  }
  const manifest = JSON.parse(await readFile(join(BACKUP_DIR, target, "manifest.json"), "utf8"));
  for (const f of manifest.files) {
    if (!f.existed) {
      console.log(dim(`  (file did not exist at backup time, leaving as-is: ${f.path})`));
      continue;
    }
    await copyFile(f.stored, f.path);
    const now = sha(await readIfExists(f.path));
    console.log(now === f.sha ? green(`  ✓ restored ${f.path}`) : red(`  ✗ checksum mismatch on ${f.path}`));
  }
  return manifest;
}

// ---------------------------------------------------------------- shared analysis

/**
 * Gather what the fixes need. Missing logs are not fatal: a fresh install has no
 * usage history yet, and that is exactly when installing the context meter is most
 * useful. Fixes that genuinely need data mark themselves unavailable instead.
 */
async function analyze(opt) {
  const pricing = await loadPricing(opt.pricing);
  const defs = await loadSourceDefs();
  const withLogs = (await detectSources(defs)).filter((d) => d.files.length);
  const agg = createAggregator(pricing);

  let src = withLogs.sort((a, b) => b.files.length - a.files.length)[0];
  if (src) {
    await readSource(src, { since: parseSince("30d"), onRecord: (r) => agg.record(r), onEvent: (e) => agg.event(e) });
  } else {
    // No logs anywhere — fall back to the harness whose config dir exists, so
    // config-only fixes still work.
    src = { def: defs.find((d) => d.name === "claude-code") ?? defs[0], files: [] };
  }
  return { pricing, src, agg: agg.finalize(), fp: await fingerprint(src.def), hasLogs: withLogs.length > 0 };
}

// ---------------------------------------------------------------- fixes

const STATUSLINE_SCRIPT = `#!/usr/bin/env bash
# Installed by token-usage-audit. Shows the two numbers that actually drive spend:
# how big the context has grown, and what this session has cost so far.
# Remove the "statusLine" key from settings.json to uninstall.
input=$(cat)
read -r PCT TOK COST MODEL <<<"$(printf '%s' "$input" | jq -r '
  [ (.context_window.used_percentage // 0 | floor),
    (.context_window.total_input_tokens // 0),
    (.cost.total_cost_usd // 0),
    (.model.display_name // "?") ] | @tsv' | tr '\\t' ' ')"

BAR_W=10
FILLED=$(( PCT * BAR_W / 100 )); [ "$FILLED" -gt "$BAR_W" ] && FILLED=$BAR_W
BAR=""
for ((i=0;i<BAR_W;i++)); do [ "$i" -lt "$FILLED" ] && BAR="\${BAR}█" || BAR="\${BAR}░"; done

if   [ "$PCT" -ge 70 ]; then C=$'\\033[31m'   # red: reset soon
elif [ "$PCT" -ge 40 ]; then C=$'\\033[33m'
else                        C=$'\\033[32m'; fi
R=$'\\033[0m'; D=$'\\033[2m'

printf "%s%s%s %s%%  %s%dk ctx%s  %s$%.2f%s  %s%s%s" \\
  "$C" "$BAR" "$R" "$PCT" "$D" "$((TOK/1000))" "$R" "$D" "$COST" "$R" "$D" "$MODEL" "$R"
`;

function buildFixes(ctx) {
  const { agg, fp, src } = ctx;
  const fixes = [];

  // ---- SAFE: context meter
  fixes.push({
    id: "context-meter",
    risk: "safe",
    title: "Install a live context + cost meter in the status line",
    why:
      "Context growth is the dominant cost driver and it is invisible while you work. " +
      "This puts a colour-coded bar, the live token count and the running session cost " +
      "on screen, so you reset before the context gets expensive rather than after.",
    available: src.def.name === "claude-code",
    targets: [join(CONFIG_DIR, "settings.json"), join(CONFIG_DIR, "token-usage-audit", "statusline.sh")],
    async preview() {
      const cur = JSON.parse((await readIfExists(join(CONFIG_DIR, "settings.json"))) || "{}");
      return cur.statusLine
        ? `settings.json already has a statusLine:\n    ${JSON.stringify(cur.statusLine)}\n  It would be REPLACED (and backed up).`
        : `settings.json gains:\n    "statusLine": { "type": "command", "command": "${join(STATE_DIR, "statusline.sh")}", "padding": 0 }`;
    },
    async run() {
      const scriptPath = join(STATE_DIR, "statusline.sh");
      await mkdir(STATE_DIR, { recursive: true });
      await writeFile(scriptPath, STATUSLINE_SCRIPT);
      await chmod(scriptPath, 0o755);

      const settingsPath = join(CONFIG_DIR, "settings.json");
      const raw = (await readIfExists(settingsPath)) || "{}";
      const json = JSON.parse(raw);
      json.statusLine = { type: "command", command: scriptPath, padding: 0 };
      await writeFile(settingsPath, JSON.stringify(json, null, 2) + "\n");
      return `installed ${scriptPath} and set statusLine in ${settingsPath}`;
    },
  });

  // ---- RISKY: agent model tiers
  const agentSpend = new Map();
  for (const s of agg.subagents) {
    const k = s.agent_type || "unknown";
    const e = agentSpend.get(k) || { calls: 0, tokens: 0, models: new Set() };
    e.calls++; e.tokens += s.total_tokens || 0;
    if (s.model) e.models.add(s.model);
    agentSpend.set(k, e);
  }
  fixes.push({
    id: "agent-models",
    risk: "risky",
    title: "Review the model tier pinned in each agent definition",
    why:
      "An agent definition's `model:` line applies to every delegation forever. Pairing " +
      "measured spend per agent type against the tier it pins is the only way to see " +
      "whether the routing you intended is the routing you got.",
    available: (fp.supported && fp.files.some((f) => f.label === "agent definitions")) || agentSpend.size > 0,
    targets: fp.supported ? fp.files.filter((f) => f.label === "agent definitions").map((f) => f.path) : [],
    async preview() {
      const lines = [];
      const defs = fp.supported ? fp.files.filter((f) => f.label === "agent definitions") : [];
      for (const f of defs) {
        const body = (await readIfExists(f.path)) || "";
        const m = /^model:\s*(.+)$/m.exec(body);
        const name = basename(f.path, ".md");
        const spend = agentSpend.get(name);
        lines.push(
          `    ${name.padEnd(18)} model: ${(m ? m[1].trim() : "(inherits)").padEnd(14)}` +
          (spend ? `${spend.calls} calls, ${(spend.tokens / 1e6).toFixed(2)}M tokens` : dim("no measured delegations"))
        );
      }
      for (const [name, e] of agentSpend) {
        if (defs.some((f) => basename(f.path, ".md") === name)) continue;
        lines.push(`    ${name.padEnd(18)} ${dim("(built-in)")}         ${e.calls} calls, ${(e.tokens / 1e6).toFixed(2)}M tokens`);
      }
      return "Agent definitions and their measured spend:\n" + lines.join("\n") +
        "\n\n  This fix REPORTS only. Changing a model tier is a judgement about output quality" +
        "\n  that usage data cannot make for you — edit the `model:` line yourself.";
    },
    async run() {
      return "reported only — no file changed (model choice is a quality judgement, not a metric)";
    },
  });

  // ---- RISKY: resident prefix trim
  fixes.push({
    id: "resident-trim",
    risk: "risky",
    title: "Trim the always-resident prefix",
    why:
      "Everything here is re-read on every turn of every session. It is the one saving " +
      "that compounds without changing how you work, and the only one the benchmark can " +
      "prove deterministically.",
    available: fp.supported,
    targets: fp.supported ? fp.files.map((f) => f.path) : [],
    async preview() {
      const rows = fp.files.slice(0, 12).map((f) =>
        `    ${String(f.tokens).padStart(6)} tok  ${f.label.padEnd(20)} ${f.path.replace(homedir(), "~")}`);
      return `Resident files, largest first (total ~${fp.total_tokens} tokens):\n${rows.join("\n")}\n` +
        `\n  Candidates: skills you never invoke, agent definitions for agents you stopped using,` +
        `\n  and instruction files that have accumulated. Edit them yourself, then run` +
        `\n  \`benchmark.mjs verify\` to measure the real delta.`;
    },
    async run() {
      return "reported only — trimming your own instruction files is a judgement call, not an automated edit";
    },
  });

  // ---- RISKY: MCP prune
  const invokedServers = new Set([...agg.toolsUsed].filter((t) => t.startsWith("mcp__")).map((t) => t.split("__")[1]));
  const configured = fp.supported ? fp.mcp_servers : [];
  const unused = configured.filter((s) => !invokedServers.has(s));
  fixes.push({
    id: "mcp-prune",
    risk: "risky",
    title: "Disable MCP servers you never invoke",
    why:
      "Every connected server's tool schemas sit in the resident prefix of every request " +
      "whether you call them or not. An unused server is a per-turn tax with no benefit.",
    available: configured.length > 0,
    targets: [join(CONFIG_DIR, "settings.json")],
    async preview() {
      if (!configured.length) return "No MCP servers found in settings — nothing to prune.";
      return `Configured: ${configured.join(", ")}\n  Invoked in the last 30 days: ${[...invokedServers].join(", ") || "none"}\n` +
        (unused.length
          ? `  ${bold("Never invoked:")} ${unused.join(", ")}`
          : "  Every configured server was used — nothing to prune.");
    },
    async run() {
      return "reported only — disabling a server changes what the agent can reach; do it deliberately";
    },
  });

  return fixes;
}

// ---------------------------------------------------------------- manual plan

function manualPlan(agg) {
  const sessions = [...agg.sessions.values()];
  const long = sessions.filter((s) => s.turns >= 150).length;
  const peak = Math.max(0, ...sessions.map((s) => s.peakCtx));

  return [
    {
      title: "Reset context at task boundaries",
      evidence: `${long} of ${sessions.size ?? sessions.length} sessions ran 150+ turns; peak context ${(peak / 1000).toFixed(0)}k tokens.`,
      why: "Every turn re-reads the whole conversation, so a long session pays for its own history repeatedly.",
      action: "Start a new session when you switch tasks. Use the context meter as the trigger — reset when the bar turns red.",
    },
    {
      title: "Keep large outputs out of the main context",
      evidence: `${agg.bigOutputs.length} tool results over 4kB were captured in the window.`,
      why: "A large output is written to cache once and re-read on every later turn of that session.",
      action: "Pipe long command output through head/grep/jq; read line ranges instead of whole files; send wide searches to a subagent whose context is discarded on return.",
    },
    {
      title: "Do not re-read files you have already read",
      evidence: `${[...agg.repeatReads.values()].filter((e) => e.count >= 3).length} files were read 3+ times in a single session.`,
      why: "A re-read appends another full copy to the context rather than refreshing the old one.",
      action: "Re-read only after an edit you did not make yourself.",
    },
    {
      title: "Match the model to the turn",
      evidence: [...agg.byModel.entries()].map(([m, v]) => `${m}: ${v.turns} turns`).join(", "),
      why: "Model choice is the one lever usage data cannot decide for you — it depends on output quality, not tokens.",
      action: "Review which agent definitions pin an expensive tier, and whether the delegations they serve genuinely need it.",
    },
  ];
}

// ---------------------------------------------------------------- commands

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "--help" || cmd === "-h") { console.log(HELP); return; }

  const opt = { dryRun: false, json: false, confirm: false };
  const positional = [];
  for (let i = 1; i < argv.length; i++) {
    switch (argv[i]) {
      case "--dry-run": opt.dryRun = true; break;
      case "--json": opt.json = true; break;
      case "--confirm": opt.confirm = true; break;
      case "--pricing": opt.pricing = argv[++i]; break;
      default: positional.push(argv[i]);
    }
  }

  if (cmd === "backups") {
    const all = (await readdir(BACKUP_DIR).catch(() => [])).sort();
    if (!all.length) return console.log("no backups");
    for (const id of all) {
      const m = JSON.parse(await readFile(join(BACKUP_DIR, id, "manifest.json"), "utf8"));
      console.log(`${m.created_at}  ${m.fix.padEnd(16)} ${m.files.length} files  ${dim(id)}`);
    }
    return;
  }

  if (cmd === "undo") {
    const m = await restore(positional[0] || "latest");
    console.log(`\nRestored backup ${m.id} (fix: ${m.fix})\n`);
    return;
  }

  const ctx = await analyze(opt);
  const fixes = buildFixes(ctx);

  if (cmd === "plan") {
    const plan = manualPlan(ctx.agg);
    if (opt.json) return console.log(JSON.stringify(plan, null, 2));
    console.log("\n" + bold("Manual action plan") + dim("  — changes no script can make for you\n"));
    plan.forEach((p, i) => {
      console.log(`  ${i + 1}. ${bold(p.title)}`);
      console.log(dim(`     evidence: ${p.evidence}`));
      console.log(dim(`     why:      ${p.why}`));
      console.log(`     do:       ${p.action}\n`);
    });
    return;
  }

  if (cmd === "list") {
    if (opt.json) return console.log(JSON.stringify(fixes.map(({ id, risk, title, why, available }) => ({ id, risk, title, why, available })), null, 2));
    console.log("\n" + bold("Available fixes") + "\n");
    for (const f of fixes) {
      const tag = f.risk === "safe" ? green("[safe]") : red("[risky]");
      const avail = f.available ? "" : dim("  (not applicable here)");
      console.log(`  ${tag} ${bold(f.id)} — ${f.title}${avail}`);
      console.log(dim(`      ${f.why}`));
      console.log("");
    }
    console.log(dim("  Risky fixes require --confirm and always print a diff first."));
    console.log(dim("  `apply.mjs plan` prints the behavioural changes no script can make.\n"));
    return;
  }

  if (cmd === "apply") {
    const id = positional[0];
    const fix = fixes.find((f) => f.id === id);
    if (!fix) throw new Error(`unknown fix "${id}" (try \`apply.mjs list\`)`);
    if (!fix.available) throw new Error(`fix "${id}" does not apply to this machine`);

    console.log(`\n${bold(fix.title)}  ${fix.risk === "safe" ? green("[safe]") : red("[risky]")}\n`);
    console.log(dim("  " + fix.why + "\n"));
    console.log("  " + (await fix.preview()).split("\n").join("\n  ") + "\n");

    if (opt.dryRun) { console.log(dim("  --dry-run: nothing written.\n")); return; }
    if (fix.risk === "risky" && !opt.confirm) {
      console.log(`  ${bold("Not applied.")} This fix is risky — re-run with --confirm if you want it.\n`);
      return;
    }

    const m = await backup(fix.id, fix.targets);
    const result = await fix.run();
    console.log(green(`  ✓ ${result}`));
    console.log(dim(`  backup: ${m.id}  (undo with: node scripts/apply.mjs undo ${m.id})\n`));
    return;
  }

  throw new Error(`unknown command "${cmd}" (try --help)`);
}

main().catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
