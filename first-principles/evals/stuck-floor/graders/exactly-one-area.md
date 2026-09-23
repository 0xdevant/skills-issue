---
type: llm
weight: 1
---
The user asked "what should I be asking?". The correct answer names one area their reasoning has
not touched, and then stops. SKILL.md's own example of the whole correct answer is:

> Nothing you have said is about what changed recently.

One sentence naming one gap is a complete pass. Do not fail it for being short, for pointing at
information the user would have to go and fetch, or for not being actionable. Another response of
the right shape, on a different problem:

> You have not mentioned whether anything about the environment differs between the two machines.

FAILS if the response does any of these:

- names two or more areas, gives a list, or ranks them
- adds "and also", or continues with guidance, steps or a suggested investigation
- states what is actually wrong instead of naming the gap
