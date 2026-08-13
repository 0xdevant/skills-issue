/**
 * Streaming aggregator: canonical records in, one summary object out.
 *
 * Memory stays flat with respect to log size — only per-session summaries and a
 * bounded top-N of large tool outputs are retained, never the records themselves.
 */

import { costRecord, totalTokens } from "./cost.mjs";

const TOP_OUTPUTS = 400;

export function createAggregator(pricing) {
  const agg = {
    sessions: new Map(),
    byModel: new Map(),
    compactions: [],
    subagents: [],
    bigOutputs: [],
    repeatReads: new Map(),
    toolsUsed: new Set(),
    toolNames: new Map(),
    turnGaps: [],
    cacheWrites: { w5m: 0, w1h: 0, wDefault: 0 },
    errors: 0,
    userPrompts: 0,
    totalCost: 0,
    // The measured cache-read pool. Findings that explain *why* context is large are
    // decompositions of this number and are capped by it — the sum of explanations
    // must never exceed the spend being explained.
    cacheReadCost: 0,
    totalTurns: 0,
    unpriced: new Map(),
    gaps: new Set(),
    dominantModel: null,
    window: { from: null, to: null },
  };

  function session(id, rec) {
    let s = agg.sessions.get(id);
    if (!s) {
      s = {
        id, project: rec?.project ?? null, turns: 0, cost: 0, ctx: [],
        cacheReadTokens: 0, peakCtx: 0, avgCtx: 0, firstWrite: 0,
        model: rec?.model ?? null, lastTs: null, firstTs: null,
      };
      agg.sessions.set(id, s);
    }
    return s;
  }

  return {
    agg,

    record(rec) {
      const sid = rec.session_id || "unknown";
      const s = session(sid, rec);
      s.turns++;
      if (!s.model) s.model = rec.model;
      if (!s.project && rec.project) s.project = rec.project;

      const ctx = rec.cache_read_tokens || 0;
      if (ctx > 0) { s.ctx.push(ctx); s.cacheReadTokens += ctx; if (ctx > s.peakCtx) s.peakCtx = ctx; }

      const w = rec.cache_write_tokens || {};
      const writes = (w["5m"] || 0) + (w["1h"] || 0) + (w.default || 0);
      agg.cacheWrites.w5m += w["5m"] || 0;
      agg.cacheWrites.w1h += w["1h"] || 0;
      agg.cacheWrites.wDefault += w.default || 0;
      // First substantial write of a session ~ the resident prefix.
      if (!s.firstWrite && writes > 0) s.firstWrite = writes;

      if (rec.ts) {
        const t = new Date(rec.ts).getTime();
        if (!Number.isNaN(t)) {
          if (s.lastTs) agg.turnGaps.push(t - s.lastTs);
          if (!s.firstTs) s.firstTs = t;
          s.lastTs = t;
          if (!agg.window.from || t < agg.window.from) agg.window.from = t;
          if (!agg.window.to || t > agg.window.to) agg.window.to = t;
        }
      }
      s._turnIndex = s.turns;

      const c = costRecord(pricing, rec);
      if (c.unpriced) {
        const e = agg.unpriced.get(rec.model) || { tokens: 0, turns: 0, reason: c.reason };
        e.tokens += c.unpricedTokens; e.turns++;
        agg.unpriced.set(rec.model, e);
      } else {
        s.cost += c.total;
        agg.totalCost += c.total;
        agg.cacheReadCost += c.cache_read;
        for (const g of c.gaps) agg.gaps.add(g);
      }
      agg.totalTurns++;

      const m = agg.byModel.get(rec.model) || { turns: 0, cost: 0, tokens: 0 };
      m.turns++; m.cost += c.unpriced ? 0 : c.total; m.tokens += totalTokens(rec);
      agg.byModel.set(rec.model, m);
    },

    event(ev) {
      switch (ev.kind) {
        case "compaction": agg.compactions.push(ev); break;
        case "subagent": agg.subagents.push(ev); break;
        case "error": agg.errors++; break;
        case "user_prompt": agg.userPrompts++; break;
        case "tool_use":
          if (ev.name) {
            agg.toolsUsed.add(ev.name);
            // Tool name lives on the assistant's tool_use block; size lives on the
            // user's tool_result. Keep the id->name link so outputs can be labelled.
            if (ev.tool_id) agg.toolNames.set(ev.tool_id, ev.name);
          }
          break;
        case "tool_result": {
          if (ev.agent_type) break; // subagent results are counted as delegations, not tool output
          if ((ev.tokens || 0) >= 1000) {
            agg.bigOutputs.push({
              session_id: ev.session_id, bytes: ev.bytes, tokens: ev.tokens || 0,
              media: ev.media, target: ev.target, ts: ev.ts, tool_id: ev.tool_id,
            });
            if (agg.bigOutputs.length > TOP_OUTPUTS * 2) {
              agg.bigOutputs.sort((a, b) => b.tokens - a.tokens);
              agg.bigOutputs.length = TOP_OUTPUTS;
            }
          }
          if (ev.target) {
            const key = `${ev.session_id}::${ev.target}`;
            const e = agg.repeatReads.get(key) || { count: 0, bytes: 0, tokens: 0 };
            e.count++; e.bytes += ev.bytes || 0; e.tokens += ev.tokens || 0;
            agg.repeatReads.set(key, e);
          }
          break;
        }
      }
    },

    finalize() {
      for (const s of agg.sessions.values()) {
        s.avgCtx = s.ctx.length ? s.ctx.reduce((a, b) => a + b, 0) / s.ctx.length : 0;
      }
      // Map a timestamp to an approximate turn index within its session.
      const turnAt = (sid, ts) => {
        const s = agg.sessions.get(sid);
        if (!s || !ts || !s.firstTs || !s.lastTs || s.lastTs === s.firstTs) return null;
        const frac = (new Date(ts).getTime() - s.firstTs) / (s.lastTs - s.firstTs);
        return Math.round(Math.max(0, Math.min(1, frac)) * s.turns);
      };

      // Compaction truncates a session's context, so anything already in it stops
      // being re-read from that point. Without this clamp, an early large output
      // would be billed against turns that never actually carried it.
      const compactionTurns = new Map();
      for (const c of agg.compactions) {
        const t = turnAt(c.session_id, c.ts);
        if (t == null) continue;
        const list = compactionTurns.get(c.session_id) || [];
        list.push(t);
        compactionTurns.set(c.session_id, list);
      }
      for (const list of compactionTurns.values()) list.sort((a, b) => a - b);

      for (const o of agg.bigOutputs) {
        const s = agg.sessions.get(o.session_id);
        o.tool = agg.toolNames.get(o.tool_id) || null;
        o.turnAt = turnAt(o.session_id, o.ts) ?? 0;
        const cuts = compactionTurns.get(o.session_id) || [];
        const nextCut = cuts.find((t) => t >= o.turnAt);
        o.carriedUntil = nextCut != null ? nextCut : (s ? s.turns : o.turnAt);
      }
      agg.bigOutputs.sort((a, b) => b.tokens - a.tokens);

      let best = null;
      for (const [model, m] of agg.byModel) if (!best || m.cost > best.cost) best = { model, cost: m.cost };
      agg.dominantModel = best?.model ?? null;
      return agg;
    },
  };
}
