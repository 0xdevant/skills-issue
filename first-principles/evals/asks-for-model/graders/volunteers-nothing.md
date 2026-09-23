---
type: llm
weight: 1
---
The response must volunteer no answer. It fails if ANY of these are true:

- it states or implies why the build is slow
- it names a candidate cause of the slowness that the user did not name (the noun test: an audit
  may reuse nouns from the question, never introduce a noun from the answer)
- it offers to investigate, profile, or look at anything on the user's behalf

It does NOT fail for naming a way to verify something ("have you profiled it?", "measured or
assumed?"). Verification methods are not candidate causes. The user said only "build" and "slow";
a named cause such as a specific tool, dependency or config being the culprit is the fail.
