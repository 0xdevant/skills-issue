# token-usage-audit

Find out where your AI coding-agent spend actually goes, fix what can be fixed
safely, and **prove** the saving with a benchmark that doesn't lie to you.

> LLM **token consumption and cost**. Not crypto tokens, not auth tokens.

Works with any model — Claude, GPT, Gemini, local — via declarative source mappings.
Reads local logs only. Nothing is uploaded. Zero npm dependencies, Node ≥ 18.

```
═══ Claude Code ═══
  12,136 priced turns across 64 sessions, 286 files, 41 days, 13,373 duplicates dropped

  Estimated spend
    total          $2645   (~$64.27/day)
    addressable    $1031   39% — sum of non-overlapping findings below

  1. Sessions that never reset  $2421 [overlaps: context-bloat]
     27 sessions ran ≥150 turns and account for 92% of all spend.
  2. Large tool outputs re-read for the rest of the session  $1580 [overlaps: context-bloat]
     347 tool results over 20kB stayed in context for the rest of their session.
  3. Oversized context re-read on every turn  $990
     Median context 168k, peak 831k.
```

## Why this exists

Most token-optimization advice targets cache hit rate. On real data that is usually
already solved — the machine this was built against had a **97% hit rate** and still
spent thousands, because 4.9 billion cache-*read* tokens were re-reading contexts that
had grown to 800k. The dominant lever is **how big the context is on every turn**, and
almost nothing measures that.

## Install

### Ask your agent to do it

Paste this prompt into any agent with shell access:

```text
Install the "token-usage-audit" skill from https://github.com/0xdevant/agent-skills

1. Clone the repo to a temp directory (or `git pull` if you already have it).
2. Copy the `token-usage-audit/` folder into wherever you load skills from.
   Common skills directories:
     Claude Code  ${CLAUDE_CONFIG_DIR:-~/.claude}/skills/token-usage-audit/
     Cursor       ~/.cursor/skills/token-usage-audit/
   If you have no skills directory, keep the clone somewhere stable and read its
   SKILL.md when I ask about token usage or AI cost.
   Use `rsync -a --delete`, not `cp -r` — cp nests the folder on re-install.
3. Verify: run `node <that-path>/scripts/audit.mjs --list-sources` and show me
   the output. It should list which agent logs it found on this machine.
4. Then run `node <that-path>/scripts/audit.mjs --since 30d` and summarise the
   findings for me.

Requirements: Node >= 18 already on PATH. There is nothing to build and no npm
install — the skill has zero dependencies. Do not run anything that uploads my
logs anywhere; this tool is local-only by design.
```

### Or do it yourself

```bash
git clone https://github.com/0xdevant/agent-skills
rsync -a --delete agent-skills/token-usage-audit/ <your-skills-dir>/token-usage-audit/
node <your-skills-dir>/token-usage-audit/scripts/audit.mjs --list-sources
```

**It needs no skills directory at all.** The scripts are an ordinary CLI — run them
straight from the clone:

```bash
cd agent-skills/token-usage-audit && node scripts/audit.mjs --since 30d
```

That matters more here than for most skills: this one audits *whatever agents you
already use*, so it is useful even from a client that has no concept of skills.

## Commands

```bash
node scripts/audit.mjs --since 30d          # where the money goes, ranked
node scripts/audit.mjs --list-sources       # what logs were found
node scripts/audit.mjs --json               # machine-readable

node scripts/benchmark.mjs snapshot --label before
node scripts/benchmark.mjs verify           # after one new session — the proof
node scripts/benchmark.mjs compare          # after ~a week — trends

node scripts/apply.mjs list                 # available fixes, by risk
node scripts/apply.mjs apply context-meter  # safe: live context + cost in the status line
node scripts/apply.mjs plan                 # the behavioural changes no script can make
node scripts/apply.mjs undo latest          # byte-identical restore
```

## The benchmark, and why it has two halves

Comparing total spend before and after a change produces a number that is dominated by
whatever you happened to work on that week. It looks authoritative and means nothing.
**This tool refuses to print it.** Instead:

### Class A — attributable

Derived from a *configuration fingerprint*: instruction files, agent/skill/command
definitions, MCP servers. Deterministic and confound-free — shrink the always-resident
prefix by N tokens and every future turn reads N fewer tokens.

```
Δoverhead × turns × read_rate   +   Δoverhead × sessions × write_rate
```

The first term dominates. `benchmark.mjs verify` then checks the prediction against a
real measured cache write from a session that started after the change, and reports the
error. If the fingerprint estimate is wrong, verify says so and tells you to trust the
measurement.

### Class B — observational

Normalized ratios over equal windows: median context per turn, turns per session, cost
per turn, compactions per session. Always confounded by workload, always labelled, and
shipped alongside a workload-similarity readout (turn counts, project counts, subagent
calls) so you can judge comparability. If the windows differ by more than 2x, the tool
tells you the numbers aren't comparable.

**No headline saving is ever reported from Class B alone.**

## What it finds

| Finding | Needs | What it catches |
|---|---|---|
| context-bloat | cache reads | Oversized context re-read every turn — usually the top item |
| session-sprawl | session ids | Sessions that never reset |
| compaction-pressure | compaction events | Paying full price for context about to be discarded |
| model-routing | model ids | Spend concentrated in expensive tiers |
| subagent-roi | subagent records | Delegations that cost more than doing it inline |
| session-start-overhead | cache writes | The fixed per-session tax, and the benchmark anchor |
| tool-output-waste | tool results | Big outputs re-read for the rest of the session |
| redundant-reads | tool results | Same file read 3+ times, each adding a copy |
| cache-ttl-fit | TTL-split writes | 1h cache premium paid on short gaps |
| tool-schema-tax | tool results | MCP servers loaded but never invoked |
| wasted-turns | error records | Errors and retries that still paid for context |

**Findings declare what they need.** A source that doesn't record cache reads gets the
cache findings *skipped with a stated reason* — never a confident zero. That gate is
what makes "works with any harness" an honest claim rather than a marketing one.

## Supported sources

| Source | Status | Notes |
|---|---|---|
| `claude-code` | **verified** | Full capability: cache, TTL split, subagents, compaction, tool results |
| `openai-generic` | **verified** | Any JSONL with OpenAI-shaped `usage`; point `AGENT_TOKEN_AUDIT_LOGS` at it |
| `codex-cli` | unverified | Field paths not confirmed against a real install |
| `gemini-cli` | unverified | Field paths not confirmed against a real install |
| `opencode` | unverified | Field paths not confirmed against a real install |
| `aider` | unverified | Aider does not persist structured token counts by default |

Unverified mappings print a warning with their output. They were written from
documented log shapes but never run against real data — if one reports zero records
while the tool clearly has logs, the mapping is wrong, not your usage. PRs very welcome.

## Pricing

`pricing.json` carries per-provider rates with a `source_url` and `fetched_at`, because
**cache billing is not the same across providers** and one hardcoded formula would
produce confidently wrong dollars for most users:

| Provider | Cache model |
|---|---|
| Anthropic | Explicit writes at a TTL-dependent premium (5m 1.25×, 1h 2×), reads 0.1× |
| OpenAI | Automatic caching: discounted cached-input rate, **no write charge** |
| Google | Cached-content rate **plus per-hour storage**, which logs don't record — reported as a gap |
| Local | Zero token cost; still analyzed for context bloat |

Models absent from the file are reported as **unpriced** with their token volume. They
are never costed at zero, because a silent zero understates spend and is worse than an
admitted gap. Override with `--pricing <file>`.

Rates change. Check `fetched_at` and re-fetch from the cited URLs before trusting the
absolute dollar figures; the *rankings* are far more stable than the totals.

## Accuracy notes

Verified against 287 real transcripts (243 MB):

- **Deduplication is essential, not cosmetic.** Claude Code writes one line per content
  block (`text`, `thinking`, `tool_use`), each repeating the *same* usage object. On the
  test corpus 52% of entries were duplicates, and a check across every repeated
  `message.id` found **zero** usage mismatches. Without dedup every number roughly doubles.
- `usage.iterations[]` must not be summed — the top level already totals it.
- `<synthetic>` model entries are API-error placeholders and are excluded.
- `isSidechain` is `false` on every entry and cannot be used to find subagent work.
- Findings that decompose cache-read spend are capped at the measured pool, so
  explanations can never exceed the spend being explained.

Token counts in the fingerprint are estimated at ~4 bytes/token; exact counts need the
model's tokenizer. That's precisely why `verify` exists.

## Contributing a source

One JSON file, no JavaScript. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Tests

```bash
node test/run.mjs     # 30 tests, no dependencies, no mocks
```

## License

MIT
