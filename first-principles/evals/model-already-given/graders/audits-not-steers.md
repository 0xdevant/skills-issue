---
type: llm
weight: 1
---
Naming an **axis** is an audit. Naming a **position** on that axis is steering.

PASSES: asking about a dimension the user has not specified, even using a term they did not use.

> How many concurrent writers does this need?
> Is this one process, or several hosts?

FAILS if the response does any of these:

- names a database or storage product other than Postgres and SQLite
- says which of the two to pick, or leans toward one
- states a position rather than asking for one ("you probably have enough writers that SQLite
  will lock")
