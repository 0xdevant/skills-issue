/**
 * Declarative source engine.
 *
 * A source is a JSON file in sources/ describing where a harness writes its logs
 * and how to map that harness's fields onto the canonical usage record. Adding a
 * new tool should not require writing JavaScript.
 *
 * Everything streams line by line — transcript directories reach hundreds of MB
 * and must never be read whole.
 */

import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCES_DIR = join(HERE, "..", "..", "sources");

/** Canonical usage record. Every field a finding may ask for is declared here. */
export const canonicalRecord = () => ({
  provider: null,
  model: null,
  ts: null,
  session_id: null,
  project: null,
  turn_index: 0,
  input_tokens: 0,
  output_tokens: 0,
  reasoning_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: { "5m": 0, "1h": 0, default: 0 },
  agent_type: null,
  tool_calls: [],
  error: null,
});

// ---------------------------------------------------------------- paths

export function expandPath(p) {
  if (!p) return null;
  let out = p.replace(/^~(?=\/|$)/, homedir());
  out = out.replace(/\$(\w+)|\$\{(\w+)\}/g, (m, a, b) => process.env[a || b] ?? "");
  return out.includes("$") || out === "" ? null : out;
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/** Minimal glob supporting `*` and `**`, which is all a log layout ever needs. */
function segmentToRegex(seg) {
  return new RegExp("^" + seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$");
}

async function walkGlob(root, pattern) {
  const segments = pattern.split("/").filter(Boolean);
  const out = [];

  async function descend(dir, idx) {
    if (idx >= segments.length) return;
    const seg = segments[idx];
    const last = idx === segments.length - 1;

    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }

    if (seg === "**") {
      // `**` matches zero or more directories: try the rest here, then recurse.
      await descend(dir, idx + 1);
      for (const e of entries) if (e.isDirectory()) await descend(join(dir, e.name), idx);
      return;
    }

    const re = segmentToRegex(seg);
    for (const e of entries) {
      if (!re.test(e.name)) continue;
      const full = join(dir, e.name);
      if (last && e.isFile()) out.push(full);
      else if (!last && e.isDirectory()) await descend(full, idx + 1);
    }
  }

  await descend(root, 0);
  return out.sort();
}

// ---------------------------------------------------------------- paths in objects

/**
 * Dotted path with two extensions that log formats genuinely need:
 *   a.b.0.c                      — numeric array index
 *   content[type=tool_use].name  — first array element whose key equals a value
 * The second exists because content blocks are order-unstable: a tool_use block
 * may sit behind any number of text or thinking blocks.
 */
export function getPath(obj, path) {
  if (!path) return undefined;
  let cur = obj;
  for (const rawKey of String(path).split(".")) {
    if (cur == null) return undefined;
    const m = /^([^[\]]+)\[([^=\]]+)=([^\]]*)\]$/.exec(rawKey);
    if (m) {
      const arr = cur[m[1]];
      if (!Array.isArray(arr)) return undefined;
      cur = arr.find((el) => el && String(el[m[2]]) === m[3]);
    } else {
      cur = cur[rawKey];
    }
  }
  return cur;
}

/**
 * Estimated context tokens for a tool result.
 *
 * Images are NOT text: their cost scales with pixel dimensions, not payload size.
 * A base64 PNG measured as text overstates its real cost by an order of magnitude
 * (34x on the corpus this was built against), which is enough to make image-heavy
 * work look like the dominant problem when it is not. Where a harness records
 * dimensions, use them; otherwise fall back to the text estimate.
 */
const IMAGE_TOKENS_PER_PIXEL = 1 / 750; // Anthropic vision: ~(w x h) / 750
const imageTokens = (w, h) => Math.round(w * h * IMAGE_TOKENS_PER_PIXEL);

/** Named transforms keep mappings declarative for things a path alone can't express. */
const TRANSFORMS = {
  json_bytes: (v) => (v == null ? 0 : Buffer.byteLength(typeof v === "string" ? v : JSON.stringify(v), "utf8")),
  result_tokens: (v) => {
    if (v == null) return 0;
    const d = v?.file?.dimensions;
    if (v?.type === "image" && d) {
      // Prefer the dimensions actually sent; harnesses downscale before upload.
      const w = d.displayWidth ?? d.originalWidth ?? 0;
      const h = d.displayHeight ?? d.originalHeight ?? 0;
      if (w > 0 && h > 0) return imageTokens(w, h);
    }
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return Math.round(Buffer.byteLength(s, "utf8") / 4);
  },
  str_len: (v) => (v == null ? 0 : String(v).length),
  array_len: (v) => (Array.isArray(v) ? v.length : 0),
  lower: (v) => (v == null ? v : String(v).toLowerCase()),
  basename: (v) => (v == null ? v : String(v).split("/").pop()),
};

function matches(obj, spec) {
  if (!spec) return true;
  for (const [path, cond] of Object.entries(spec)) {
    const val = getPath(obj, path);
    if (cond === "$exists") { if (val == null) return false; continue; }
    if (cond !== null && typeof cond === "object") {
      if ("$exists" in cond && (val != null) !== cond.$exists) return false;
      if ("$ne" in cond && val === cond.$ne) return false;
      if ("$in" in cond && !cond.$in.includes(val)) return false;
      if ("$nin" in cond && cond.$nin.includes(val)) return false;
      continue;
    }
    if (val !== cond) return false;
  }
  return true;
}

/** Assign into a canonical record, honouring dotted targets like cache_write_tokens.5m */
function assign(target, dottedKey, value) {
  const keys = dottedKey.split(".");
  let cur = target;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

const NUMERIC = new Set([
  "input_tokens", "output_tokens", "reasoning_tokens", "cache_read_tokens",
  "cache_write_tokens.5m", "cache_write_tokens.1h", "cache_write_tokens.default", "turn_index",
]);

function applyMap(entry, map, base) {
  const rec = base;
  for (const [field, spec] of Object.entries(map)) {
    let value;
    if (spec && typeof spec === "object" && !Array.isArray(spec)) {
      if ("const" in spec) value = spec.const;
      else {
        // `paths` takes the first path that resolves — for harnesses that renamed a field.
        const paths = spec.paths || [spec.path];
        for (const p of paths) { value = getPath(entry, p); if (value != null) break; }
        if (spec.transform) {
          const fn = TRANSFORMS[spec.transform];
          if (!fn) throw new Error(`unknown transform "${spec.transform}" in source mapping`);
          value = fn(value);
        }
        if (value == null) value = spec.default;
      }
    } else {
      value = getPath(entry, spec);
    }
    if (value === undefined) continue;
    if (NUMERIC.has(field)) value = Number(value) || 0;
    assign(rec, field, value);
  }
  return rec;
}

// ---------------------------------------------------------------- loading

export async function loadSourceDefs(dir = SOURCES_DIR) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const defs = [];
  for (const f of files) {
    const def = JSON.parse(await readFile(join(dir, f), "utf8"));
    def._file = join(dir, f);
    defs.push(def);
  }
  return defs;
}

/** Which sources actually have data on this machine. */
export async function detectSources(defs) {
  const found = [];
  for (const def of defs) {
    for (const rootSpec of def.roots || []) {
      const root = expandPath(rootSpec);
      if (!root || !(await exists(root))) continue;
      const files = await walkGlob(root, def.glob);
      if (files.length) { found.push({ def, root, files }); break; }
      // Root exists but no logs: record it so the report can say "installed, no data"
      if (!found.some((f) => f.def.name === def.name)) found.push({ def, root, files: [] });
      break;
    }
  }
  return found;
}

export function hasCapability(def, cap) {
  return (def.capabilities || []).includes(cap);
}

// ---------------------------------------------------------------- reading

/**
 * Stream one detected source into canonical records + side events.
 * `onRecord` / `onEvent` are called as data arrives; nothing accumulates here
 * beyond the dedup set, so memory stays flat regardless of log size.
 */
export async function readSource(detected, { since = null, onRecord, onEvent } = {}) {
  const { def, files } = detected;
  const seen = new Set();
  const stats = { files: 0, lines: 0, malformed: 0, records: 0, deduped: 0, events: 0 };
  const sinceMs = since ? new Date(since).getTime() : null;
  const turnCounters = new Map();

  for (const file of files) {
    stats.files++;
    const stem = basename(file, extname(file));
    const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      stats.lines++;
      let entry;
      try { entry = JSON.parse(line); } catch { stats.malformed++; continue; }

      // side events (compaction, subagent spend, tool results)
      for (const ev of def.events || []) {
        if (!matches(entry, ev.select)) continue;
        if (ev.exclude && matches(entry, ev.exclude)) continue;
        const mapped = applyMap(entry, ev.map || {}, { kind: ev.kind, _file: file });
        if (sinceMs && mapped.ts && new Date(mapped.ts).getTime() < sinceMs) continue;
        stats.events++;
        onEvent?.(mapped);
      }

      const spec = def.records;
      if (!spec || !matches(entry, spec.select)) continue;
      if (spec.exclude && matches(entry, spec.exclude)) continue;

      if (spec.dedup_key) {
        const k = getPath(entry, spec.dedup_key);
        if (k != null) {
          if (seen.has(k)) { stats.deduped++; continue; }
          seen.add(k);
        }
      }

      const rec = applyMap(entry, spec.map || {}, canonicalRecord());
      if (def.provider_hint && !rec.provider) rec.provider = def.provider_hint;
      if (!rec.session_id && def.session_id_from === "filename_stem") rec.session_id = stem;
      if (sinceMs && rec.ts && new Date(rec.ts).getTime() < sinceMs) continue;

      const key = rec.session_id || stem;
      const n = (turnCounters.get(key) || 0) + 1;
      turnCounters.set(key, n);
      if (!rec.turn_index) rec.turn_index = n;

      rec._source = def.name;
      stats.records++;
      onRecord?.(rec);
    }
  }

  return stats;
}

/** "7d" / "24h" / ISO date -> ISO string */
export function parseSince(s) {
  if (!s) return null;
  const m = /^(\d+)([dhw])$/.exec(s.trim());
  if (m) {
    const mult = { h: 3600e3, d: 86400e3, w: 604800e3 }[m[2]];
    return new Date(Date.now() - Number(m[1]) * mult).toISOString();
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`unparseable --since value: ${s}`);
  return d.toISOString();
}
