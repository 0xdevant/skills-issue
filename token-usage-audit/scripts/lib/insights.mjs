/**
 * Bridge to Claude Code's own `/insights` output.
 *
 * `/insights` analyses sessions for OUTCOME and FRICTION but not cost. This tool
 * measures COST but cannot tell a productive session from a wasted one. Both key
 * their data on the same session_id, so joining them answers the question neither
 * can alone: which sessions were expensive AND went badly.
 *
 * Everything here degrades to null when `/insights` has never been run. It is a
 * bonus signal, never a dependency.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";

const DIR = () => join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "usage-data");

async function readJsonDir(dir) {
  const out = new Map();
  let names = [];
  try { names = (await readdir(dir)).filter((f) => f.endsWith(".json")); } catch { return out; }
  for (const n of names) {
    try { out.set(basename(n, ".json"), JSON.parse(await readFile(join(dir, n), "utf8"))); } catch { /* skip */ }
  }
  return out;
}

const decode = (s) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<")
   .replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&")
   .replace(/\\n/g, "\n");

/**
 * The aggregate suggestions live only in the rendered HTML, not in the JSON facets.
 * They sit in data-text attributes on the checkbox inputs, shaped as
 * "<where to put it>\n\n<the markdown block>".
 */
function parseSuggestions(html) {
  const out = [];
  const re = /id="cmd-(\d+)"[^>]*data-text="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const text = decode(m[2]);
    const i = text.indexOf("\n\n");
    const scaffold = i > 0 ? text.slice(0, i).trim() : "";
    const body = (i > 0 ? text.slice(i + 2) : text).trim();
    const heading = (/^##\s*(.+)$/m.exec(body) || [])[1]?.trim() || null;
    out.push({ id: Number(m[1]), heading, placement: scaffold, body });
  }
  return out;
}

export async function loadInsights() {
  const dir = DIR();
  const facets = await readJsonDir(join(dir, "facets"));
  const meta = await readJsonDir(join(dir, "session-meta"));

  let report = null;
  try {
    const p = join(dir, "report.html");
    const st = await stat(p);
    const html = await readFile(p, "utf8");
    report = {
      path: p,
      ageDays: (Date.now() - st.mtimeMs) / 86400e3,
      suggestions: parseSuggestions(html),
    };
  } catch { /* never run */ }

  return {
    available: facets.size > 0 || !!report,
    dir, facets, meta, report,
  };
}

/**
 * Join per-session cost (ours) with per-session outcome and friction (theirs).
 * Sessions missing from either side are reported, not silently dropped: a partial
 * join that looks complete is how you end up trusting a number built on 20% of data.
 */
export function joinSessions(agg, insights) {
  const rows = [];
  let costed = 0, matched = 0;
  for (const s of agg.sessions.values()) {
    costed++;
    const f = insights.facets.get(s.id);
    if (!f) continue;
    matched++;
    rows.push({
      id: s.id, cost: s.cost, turns: s.turns, peakCtx: s.peakCtx, project: s.project,
      outcome: f.outcome || "unknown",
      frictions: Object.keys(f.friction_counts || {}),
      frictionCounts: f.friction_counts || {},
      goal: f.underlying_goal || "",
      summary: f.brief_summary || "",
      helpfulness: f.claude_helpfulness || null,
      meta: insights.meta.get(s.id) || null,
    });
  }
  return { rows, costed, matched, coverage: costed ? matched / costed : 0 };
}
