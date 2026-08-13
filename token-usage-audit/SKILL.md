---
name: token-usage-audit
description: >-
  Audits and reduces AI coding-agent token spend by reading the logs your agent
  already writes locally, then proves the saving with a before/after benchmark.
  Use when asked about token usage, AI/LLM cost, "why is Claude/Codex/Gemini so
  expensive", reducing an AI bill, context bloat, prompt-cache spend, model
  routing, subagent cost, or measuring whether a change actually saved tokens.
  Works with any model (Claude, GPT, Gemini, local) via declarative source
  mappings. This is about LLM token consumption and cost — not crypto tokens,
  not auth tokens. Reads local logs only and never uploads anything. ALWAYS
  snapshot a baseline before applying fixes, or a benchmark becomes impossible.
  NEVER present estimated cost as a bill, and NEVER report a saving from
  workload-confounded metrics alone.
---

# Token Usage Audit

Reads the logs your coding agent already writes, prices them per provider, and reports
where the money actually goes — ranked, with a named fix for each finding. Then it
applies the safe fixes, hands you a plan for the ones no script can make, and proves
the result with a benchmark that separates what it can attribute from what it cannot.

Everything runs locally against files already on disk. No network calls, no uploads.

This skill is a sequence, not a menu. Do every step, in order, once per request.

## Step 1 — Snapshot the baseline FIRST

```bash
node scripts/benchmark.mjs snapshot --label before
```

Do this before touching anything. It records the configuration fingerprint and the
normalized usage metrics that every later comparison depends on. A fix applied
without a baseline can never be measured — the evidence is gone.

## Step 2 — Run the audit

```bash
node scripts/audit.mjs --since 30d
```

Add `--source <name>` to restrict to one harness, `--project <substring>` to restrict
to one codebase, `--json` for machine output. `--list-sources` shows what was detected.

## Step 3 — Establish how the user actually pays, THEN present the findings

**Ask first if you do not know: flat-rate subscription, or API/pay-as-you-go?** This
changes what the entire report means, and getting it wrong is the single most
misleading thing this skill can do.

- **Subscription** (Claude Pro/Max, Cursor, Copilot…): re-run with
  `--plan <usd/month>`. The dollar figures become the *value they extract from the
  plan*, not money they spend. Reducing them saves nothing — their bill is flat. What
  optimization buys is rate-limit headroom and tighter sessions. Say so explicitly.
- **API billing**: the figures approximate real money, still at list price.

Report findings in the order the tool ranks them, with the figure and the evidence
table. Rules when relaying them:

- **Never call the figures "spend" for a subscription user.** They are API-equivalent
  value. A $2,000 report against a $200 plan is a 10x return, not a problem to fix.
- **Say "estimated"**, every time. These are list-price estimates from local logs.
  Discounts and credits are not modelled. It is never a bill.
- **Respect the `[overlaps: …]` tags.** Tagged findings describe the same dollars
  from a different angle and are already excluded from the addressable total. Do not
  add them back up.
- **Report the "Not evaluated" list.** A finding the source cannot support is stated,
  not silently dropped. That distinction is the point.

## Step 4 — Apply the safe fixes

```bash
node scripts/apply.mjs list
node scripts/apply.mjs apply context-meter
```

Safe fixes are additive and reversible; apply them directly. Every write is backed up
and `apply.mjs undo <id>` restores byte-identically.

## Step 5 — Show the risky fixes, then confirm

```bash
node scripts/apply.mjs apply <id> --dry-run
```

Risky fixes edit content the user wrote or change what the agent can reach. Show the
`--dry-run` output, explain the trade-off, and re-run with `--confirm` only after the
user agrees. Never pass `--confirm` on the user's behalf.

## Step 6 — Emit the manual plan

```bash
node scripts/apply.mjs plan
```

The largest savings are usually behavioural — when to reset context, how to keep large
outputs out of it. These cannot be automated and must not be dropped. Relay them with
the evidence attached.

## Step 7 — Tell the user how to prove it

Two commands, two different guarantees. Say which is which:

- `benchmark.mjs verify` — after **one** new session. Checks the predicted resident-prefix
  change against a real measured cache write. This is the proof.
- `benchmark.mjs compare` — after **a week or so**. Normalized trends, explicitly
  workload-confounded.

## Output contract

- Findings ranked by estimated cost, each with evidence and a named fix.
- Every dollar figure labelled as an estimate.
- Skipped findings listed with the reason they were skipped.
- Unpriced models named, with their token volume — never folded into a total as zero.

## Hard rules

- **Never report a saving from Class B (observational) metrics alone.** They are
  confounded by workload. The tool refuses to print such a headline; do not add one.
- **Never present estimated cost as a bill**, and never as "spend" for a subscription
  user — most agent users are on flat-rate plans, where the figures are plan value.
- **Never claim a finding the source cannot support.** If a harness does not log cache
  reads, say the finding is unavailable — do not report zero.
- **Never cost an unknown model at zero.** It is reported as unpriced, by design.
- **Never write a config file without a backup**, and never pass `--confirm` yourself.
- **Never suggest uploading logs anywhere.** They contain the user's source code.
- If a source mapping is marked `unverified`, say so when reporting its numbers.

## Do NOT use for

- Reconciling an actual invoice — these are list-price estimates from local logs.
- Harnesses that do not write token counts to disk. Many GUI IDEs do not; the tool
  reports "no usable signal" rather than inventing one.
- Deciding whether a model was *worth* its cost. The tool reports the ratio and
  refuses to claim a saving; that judgement is about output quality, not tokens.

## Prerequisites

- `node` ≥ 18 on PATH (ESM, zero npm dependencies).
- At least one supported agent's logs on disk. `--list-sources` reports what it found.
- `jq` only if you install the context meter (the status line script uses it).
