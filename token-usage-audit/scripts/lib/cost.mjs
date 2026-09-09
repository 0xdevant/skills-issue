/**
 * Multi-provider cost model.
 *
 * Providers do not bill caching the same way, so there is no single formula here.
 * Each provider declares a `cache_model` in pricing.json and gets its own branch.
 * Anything we cannot model from the log (Google's cache-storage hours, unlisted
 * models) is reported as a gap, never silently costed at zero.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRICING = join(HERE, "..", "..", "pricing.json");
const PER_TOKEN = 1_000_000;

export async function loadPricing(path = DEFAULT_PRICING) {
  const raw = JSON.parse(await readFile(path, "utf8"));
  if (raw.schema_version !== 1) {
    throw new Error(`pricing.json schema_version ${raw.schema_version} unsupported (expected 1)`);
  }
  return raw;
}

/** Trailing release-date suffixes: claude-haiku-4-5-20251001 -> claude-haiku-4-5 */
function stripDateSuffix(model) {
  return model.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

/**
 * Resolve a raw model id to rates. Exact match wins; otherwise the longest
 * pricing key that prefixes the model id, so `gpt-5.4-mini-2026-01` still lands
 * on `gpt-5.4-mini` rather than the shorter, cheaper `gpt-5`.
 */
export function resolveModel(pricing, rawModel) {
  const model = stripDateSuffix(String(rawModel || "").trim().toLowerCase());
  if (!model) return { unpriced: true, reason: "empty model id", model: rawModel };

  for (const [provider, block] of Object.entries(pricing.providers)) {
    const claims = (block.match || []).some((m) => model.startsWith(m.toLowerCase()));
    const exact = block.models[model];
    const wildcard = block.models["*"];
    if (!claims && !exact) continue;

    let rates = exact;
    if (!rates) {
      const prefixes = Object.keys(block.models)
        .filter((k) => k !== "*" && model.startsWith(k.toLowerCase()))
        .sort((a, b) => b.length - a.length);
      rates = prefixes.length ? block.models[prefixes[0]] : wildcard;
    }
    if (!rates) {
      return {
        unpriced: true,
        provider,
        model: rawModel,
        reason: `model not listed under provider "${provider}" in pricing.json`,
      };
    }
    return { unpriced: false, provider, model: rawModel, rates, cacheModel: block.cache_model };
  }

  return { unpriced: true, model: rawModel, reason: "no provider claims this model id" };
}

/**
 * Cost one canonical usage record.
 * Returns dollar components plus `gaps`, things this record's provider bills
 * but the log did not record well enough to compute.
 */
export function costRecord(pricing, rec) {
  const res = resolveModel(pricing, rec.model);
  const zero = { input: 0, output: 0, cache_read: 0, cache_write: 0, total: 0 };
  if (res.unpriced) {
    return { ...zero, unpriced: true, unpricedTokens: totalTokens(rec), reason: res.reason, gaps: [] };
  }

  const r = res.rates;
  const gaps = [];
  const per = (tokens, rate) => ((tokens || 0) * (rate || 0)) / PER_TOKEN;

  const input = per(rec.input_tokens, r.input);
  // Reasoning/thinking tokens bill as output where the provider surfaces them
  // separately; where they are already folded into output_tokens the mapping
  // leaves reasoning_tokens at 0, so this cannot double-count.
  const output = per(rec.output_tokens, r.output) + per(rec.reasoning_tokens, r.output);

  let cacheRead = 0;
  let cacheWrite = 0;
  const w = rec.cache_write_tokens || {};

  switch (res.cacheModel) {
    case "explicit_write_ttl":
      cacheRead = per(rec.cache_read_tokens, r.cache_read);
      cacheWrite =
        per(w["5m"], r.cache_write_5m) +
        per(w["1h"], r.cache_write_1h) +
        per(w.default, r.cache_write_5m); // untyped writes bill at the default TTL
      break;

    case "discounted_read":
      // Automatic caching: cached input is just a cheaper input rate, no write charge.
      if (r.cache_read == null && rec.cache_read_tokens) {
        gaps.push(`${res.model}: no cached-input rate published; cached tokens billed at full input rate`);
        cacheRead = per(rec.cache_read_tokens, r.input);
      } else {
        cacheRead = per(rec.cache_read_tokens, r.cache_read);
      }
      break;

    case "cached_content_plus_storage":
      cacheRead = per(rec.cache_read_tokens, r.cache_read ?? r.input);
      if (rec.cache_read_tokens && r.cache_storage_per_1m_hour) {
        gaps.push(
          `${res.model}: cache storage billed at $${r.cache_storage_per_1m_hour}/1M/hour, ` +
            `but cache lifetime is not in the log, storage cost excluded`
        );
      }
      break;

    case "none":
      break;

    default:
      gaps.push(`unknown cache_model "${res.cacheModel}", cache tokens excluded from cost`);
  }

  const total = input + output + cacheRead + cacheWrite;
  return { input, output, cache_read: cacheRead, cache_write: cacheWrite, total, unpriced: false, provider: res.provider, gaps };
}

export function totalTokens(rec) {
  const w = rec.cache_write_tokens || {};
  return (
    (rec.input_tokens || 0) +
    (rec.output_tokens || 0) +
    (rec.reasoning_tokens || 0) +
    (rec.cache_read_tokens || 0) +
    (w["5m"] || 0) + (w["1h"] || 0) + (w.default || 0)
  );
}

/** Effective $/token for cache reads, used to price "excess context" findings. */
export function cacheReadRate(pricing, model) {
  const res = resolveModel(pricing, model);
  if (res.unpriced) return null;
  const r = res.rates;
  const rate = r.cache_read ?? r.input;
  return rate == null ? null : rate / PER_TOKEN;
}

export const usd = (n) =>
  n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
