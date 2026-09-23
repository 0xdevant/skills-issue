---
type: llm
weight: 1
---
Fails if ANY of these are true:

- it names a database or storage product other than Postgres and SQLite
- it says which of the two to pick, or leans toward one
- an assumption it names uses a technical noun the user did not already use

Naming an axis is allowed ("how many concurrent writers?"). Naming a position on that axis, or a
candidate answer, is steering and fails.
