/**
 * Resident-prefix fingerprint.
 *
 * Measures what every request carries before any work happens: instruction files,
 * agent/skill/command definitions, configured MCP servers. This is the ONLY part of
 * the benchmark that is confound-free, it is a property of your configuration, not
 * of what you happened to work on that week.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { expandPath } from "./sources.mjs";

/**
 * Token estimate from bytes. Deliberately a documented approximation: exact counts
 * need the model's tokenizer, which is not available offline. The benchmark's
 * `verify` step exists precisely because this estimate must be checked against a
 * real measured cache write rather than trusted.
 */
export const BYTES_PER_TOKEN = 4;
export const estTokens = (bytes) => Math.round(bytes / BYTES_PER_TOKEN);

async function tryStat(p) {
  try { return await stat(p); } catch { return null; }
}

async function globFlat(root, pattern) {
  // Patterns here are shallow (`agents/*.md`, `skills/*/SKILL.md`) by design.
  const parts = pattern.split("/");
  const out = [];
  async function walk(dir, idx) {
    if (idx >= parts.length) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    const seg = parts[idx];
    const re = new RegExp("^" + seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    const last = idx === parts.length - 1;
    for (const e of entries) {
      if (!re.test(e.name)) continue;
      const full = join(dir, e.name);
      if (last && e.isFile()) out.push(full);
      else if (!last && e.isDirectory()) await walk(full, idx + 1);
    }
  }
  await walk(root, 0);
  return out;
}

async function countMcpTools(settingsPaths) {
  const servers = new Set();
  for (const raw of settingsPaths) {
    const p = expandPath(raw);
    if (!p) continue;
    try {
      const json = JSON.parse(await readFile(p, "utf8"));
      for (const key of ["mcpServers", "mcp_servers"]) {
        if (json[key]) for (const name of Object.keys(json[key])) servers.add(name);
      }
    } catch { /* absent or unreadable, reported as zero, which is accurate here */ }
  }
  return [...servers];
}

/**
 * Agent and skill definitions do NOT load whole. Only the frontmatter `description`
 * is resident in every request; the body loads on demand when the thing is invoked.
 * Counting whole files overstates the resident prefix several-fold and sends people
 * trimming files that cost them nothing.
 */
function residentBytes(content, mode) {
  if (mode !== "description") return content.length;
  const fm = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!fm) return content.length;
  const desc = /description:\s*([\s\S]*?)(?=\n[a-z_-]+:\s|\n?$)/i.exec(fm[1]);
  // Name plus a little structural overhead ships alongside the description.
  const nameLen = (/name:\s*(.*)/i.exec(fm[1])?.[1] || "").length;
  return (desc ? desc[1].trim().length : 0) + nameLen + 16;
}

/** Skills switched off in settings are not loaded at all, they cost nothing. */
async function disabledSkills(settingsPaths) {
  const off = new Set();
  for (const raw of settingsPaths) {
    const p = expandPath(raw);
    if (!p) continue;
    try {
      const json = JSON.parse(await readFile(p, "utf8"));
      for (const [name, state] of Object.entries(json.skillOverrides || {})) {
        if (state === "off" || state === false || state === "disabled") off.add(name);
      }
    } catch { /* absent or unreadable */ }
  }
  return off;
}

export async function fingerprint(sourceDef) {
  const fp = sourceDef.fingerprint;
  if (!fp) return { supported: false, reason: `source "${sourceDef.name}" declares no fingerprint config` };

  const files = [];
  const seen = new Set();
  const excluded = [];
  const off = await disabledSkills(fp.settings_files || []);

  const add = async (path, label, mode = "full") => {
    const p = expandPath(path);
    if (!p || seen.has(p)) return;
    const st = await tryStat(p);
    if (!st || !st.isFile()) return;
    seen.add(p);

    // A skill directory's name is its identifier for skillOverrides.
    const skillName = /\/skills\/([^/]+)\/SKILL\.md$/.exec(p)?.[1];
    if (skillName && off.has(skillName)) {
      excluded.push({ path: p, reason: `disabled via skillOverrides, not loaded, costs nothing` });
      return;
    }

    let content = "";
    try { content = await readFile(p, "utf8"); } catch { return; }
    const bytes = residentBytes(content, mode);
    files.push({
      path: p, label, bytes, tokens: estTokens(bytes),
      full_bytes: st.size, on_demand_tokens: estTokens(st.size - bytes), mode,
    });
  };

  for (const f of fp.instruction_files || []) await add(f, "instruction files", "full");

  for (const g of fp.definition_globs || []) {
    const root = expandPath(g.root);
    if (!root) continue;
    // Agent/skill/command definitions surface only their description up front.
    for (const f of await globFlat(root, g.glob)) await add(f, g.label, g.mode || "description");
  }

  const mcpServers = await countMcpTools(fp.settings_files || []);

  const byLabel = {};
  for (const f of files) {
    byLabel[f.label] = byLabel[f.label] || { files: 0, bytes: 0, tokens: 0 };
    byLabel[f.label].files++;
    byLabel[f.label].bytes += f.bytes;
    byLabel[f.label].tokens += f.tokens;
  }

  const totalTokens = files.reduce((a, f) => a + f.tokens, 0);

  return {
    supported: true,
    measured_at: new Date().toISOString(),
    total_tokens: totalTokens,
    on_demand_tokens: files.reduce((a, f) => a + (f.on_demand_tokens || 0), 0),
    by_label: byLabel,
    mcp_servers: mcpServers,
    excluded,
    files: files
      .sort((a, b) => b.tokens - a.tokens)
      .map((f) => ({ ...f, name: basename(f.path) })),
    caveats: [
      `Token counts estimated at ~${BYTES_PER_TOKEN} bytes/token; exact counts need the model tokenizer.`,
      "Agent and skill definitions count their frontmatter description ONLY, bodies load on " +
        "demand when invoked. Counting whole files overstates the resident prefix several-fold.",
      "Skills disabled in settings are excluded entirely; they are not loaded and cost nothing.",
      "MCP tool schemas are counted by server, not by token: their size lives in the running " +
        "process, not on disk. `verify` measures the real total from the next session.",
    ],
  };
}

/** Token delta between two fingerprints, per file, so a change is attributable. */
export function diffFingerprints(before, after) {
  if (!before?.supported || !after?.supported) return { supported: false };
  const idx = (fp) => new Map(fp.files.map((f) => [f.path, f]));
  const b = idx(before), a = idx(after);
  const changes = [];

  for (const [path, bf] of b) {
    const af = a.get(path);
    if (!af) changes.push({ path, name: bf.name, delta: -bf.tokens, kind: "removed" });
    else if (af.tokens !== bf.tokens) changes.push({ path, name: bf.name, delta: af.tokens - bf.tokens, kind: "changed" });
  }
  for (const [path, af] of a) if (!b.has(path)) changes.push({ path, name: af.name, delta: af.tokens, kind: "added" });

  changes.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return {
    supported: true,
    delta_tokens: after.total_tokens - before.total_tokens,
    before_tokens: before.total_tokens,
    after_tokens: after.total_tokens,
    mcp_delta: after.mcp_servers.length - before.mcp_servers.length,
    changes,
  };
}
