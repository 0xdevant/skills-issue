# Contributing a source

Adding support for a new agent or harness is **one JSON file in `sources/`**. No
JavaScript. This is deliberate — the project should scale to tools neither the author
nor you have seen.

## The 60-second version

1. Find where your tool writes logs and confirm they contain token counts.
2. Copy `sources/openai-generic.json` and edit the paths.
3. Run `node scripts/audit.mjs --source <yourname>` and check the record count.
4. Set `"status": "verified"` once you've confirmed it against a real install, and PR.

## Does your tool even log tokens?

Check first. Many don't, and a mapping cannot invent data.

```bash
grep -rl 'usage\|tokens\|token_count' ~/.yourtool/ 2>/dev/null | head
```

If nothing turns up, the honest outcome is a mapping with `"capabilities": []` that
reports "no usable token signal" — which is still useful, because it stops users
wondering. Cursor is the worked example: its `ai-code-tracking.db` records AI-authored
*lines* and commit attribution, with no token columns anywhere.

## The mapping file

```jsonc
{
  "name": "mytool",                    // must match the filename
  "display_name": "My Tool",
  "status": "unverified",              // "verified" only after testing on real logs
  "provider_hint": "openai",           // omit for multi-provider tools; model id drives pricing
  "roots": ["$MYTOOL_HOME", "~/.mytool"],   // first one that exists wins
  "glob": "sessions/**/*.jsonl",
  "format": "jsonl",
  "session_id_from": "filename_stem",  // fallback when no session field is mapped
  "capabilities": ["cache", "errors"],

  "records": {
    "select":  { "type": "assistant", "usage": "$exists" },
    "exclude": { "model": "placeholder" },
    "dedup_key": "message.id",
    "map": {
      "model": "model",
      "ts": "timestamp",
      "input_tokens":  { "path": "usage.input_tokens", "default": 0 },
      "output_tokens": { "path": "usage.output_tokens", "default": 0 }
    }
  },

  "events": [
    { "kind": "compaction", "select": { "type": "compact" }, "map": { "pre_tokens": "meta.before" } }
  ]
}
```

### Capabilities — the important part

`capabilities` is a promise about what your logs actually contain. Findings are gated on
it: a source without `cache` gets the cache findings **skipped with a stated reason**
instead of reporting a confident zero.

| Capability | Declare it when the log records |
|---|---|
| `cache` | cache read and/or write token counts |
| `cache_ttl` | cache writes split by TTL (Anthropic-style) |
| `subagents` | delegated/sub-agent spend |
| `tool_results` | tool call results, ideally with sizes |
| `compaction` | context compaction/summarization events |
| `errors` | API errors, refusals, interruptions |
| `fingerprint` | you also filled in the `fingerprint` block |

**Over-declaring is the one thing that breaks the project's core promise.** If you are
not sure your logs contain something, leave it out.

### Path syntax

| Form | Meaning |
|---|---|
| `a.b.c` | nested object access |
| `a.items.0.name` | array index |
| `content[type=tool_use].name` | first array element whose `type` equals `tool_use` |

Content blocks are order-unstable, which is why the third form exists — a `tool_use`
block can sit behind any number of `text` or `thinking` blocks.

### Map value forms

```jsonc
"model": "message.model"                                  // plain path
"tokens": { "path": "usage.total", "default": 0 }         // path with fallback
"ts":     { "paths": ["created_at", "timestamp"] }        // first path that resolves
"kind":   { "const": "api_error" }                        // literal
"bytes":  { "path": "result", "transform": "json_bytes" } // computed
```

Transforms: `json_bytes`, `str_len`, `array_len`, `lower`, `basename`.

### Predicates for `select` / `exclude`

```jsonc
{ "type": "assistant" }              // equality
{ "usage": "$exists" }               // present and non-null
{ "model": { "$ne": "internal" } }
{ "role":  { "$in": ["assistant", "model"] } }
{ "kind":  { "$nin": ["debug"] } }
{ "meta":  { "$exists": false } }
```

## Canonical record

Map onto these fields. Anything you can't fill, leave out — defaults are zero/null,
and findings gate on capabilities rather than on non-zero values.

```jsonc
{
  "provider": null, "model": null, "ts": null,
  "session_id": null, "project": null, "turn_index": 0,
  "input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0,
  "cache_read_tokens": 0,
  "cache_write_tokens": { "5m": 0, "1h": 0, "default": 0 },
  "agent_type": null, "tool_calls": [], "error": null
}
```

Use `cache_write_tokens.default` unless your provider genuinely bills by TTL. For
providers with automatic caching (OpenAI-style), map only `cache_read_tokens` — there
is no write charge to model, and the cost engine already knows that.

## Pricing a new provider

Add a block to `pricing.json` with a **`source_url` and `fetched_at`**. Rates must be
copied from the cited page, never written from memory.

Pick the `cache_model` that matches how the provider actually bills:

- `explicit_write_ttl` — separate write charge, TTL-dependent (Anthropic)
- `discounted_read` — automatic caching, cheaper cached input, no write charge (OpenAI)
- `cached_content_plus_storage` — discounted read plus per-hour storage (Google)
- `none` — local/self-hosted

## Testing

```bash
node scripts/audit.mjs --list-sources                 # is it detected?
node scripts/audit.mjs --source mytool --since 7d     # does it produce records?
node test/run.mjs                                     # nothing else broke?
```

If detection works but records are zero, your `select` predicate doesn't match. Print a
raw line and compare:

```bash
head -1 ~/.mytool/sessions/*.jsonl | python3 -m json.tool | head -40
```

Please add a test to `test/run.mjs` with a small synthetic fixture for your format —
the suite uses real temp files and no mocks, precisely because the failure that matters
is "the mapping silently matched nothing".

## Ground rules

The project's value rests on not overstating what it knows. PRs are held to that:

- Don't declare capabilities the logs don't have.
- Don't add pricing from memory — cite the URL.
- Don't make a finding report zero when it means "unknown".
- Mark a mapping `verified` only after running it against a real install.
