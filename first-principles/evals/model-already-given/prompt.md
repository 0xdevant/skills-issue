---
name: model-already-given
description: The model is already stated, so rule 2 is satisfied. Audit without introducing a third option.
tags: [rule-2-exception, rule-3]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---
/first-principles should I use Postgres or SQLite here? I'm leaning SQLite because it's one file and I don't want to run a server.
