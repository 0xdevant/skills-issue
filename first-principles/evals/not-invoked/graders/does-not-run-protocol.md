---
type: llm
weight: 1
---
Fails if the response runs the first-principles protocol uninvited. Signs of failure:

- it requires the user to state what they think the answer is before it will help
- it asks them to split their reasoning into verified versus assumed
- it refuses to name any possible cause
- it mentions a first-principles mode, protocol or skill

Asking a normal diagnostic question ("what build tool?") is not the protocol and is fine.
