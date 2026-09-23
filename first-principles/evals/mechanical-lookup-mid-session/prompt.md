---
name: mechanical-lookup-mid-session
description: A factual lookup arrives mid-session. It gets answered plainly; the judgment question does not.
tags: [scope, anti-pattern-6]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---
/first-principles should this be a queue or a cron job? I think queue, verified we have bursty load, assuming the jobs are idempotent.

also what's the flag to run wrangler in local mode?
