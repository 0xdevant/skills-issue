---
type: llm
weight: 1
---
Passes if the response answers the wrangler local-mode question directly, anywhere in its reply.

A version-dependent answer is still a direct answer, and so is saying that local is the default in
current versions and naming the flag that opts out. Do not fail it for being qualified, for being
brief, or for appearing after the other half of the prompt.

FAILS only if the response asks the user to reason the flag out, demands a model before answering
it, defers it to later, or never answers it at all.
