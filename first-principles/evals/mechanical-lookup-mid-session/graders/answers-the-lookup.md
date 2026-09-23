---
type: llm
weight: 1
---
Passes only if the response answers the wrangler local-mode flag directly. Fails if it asks the
user to reason it out, asks for a model before answering it, or declines because a session is
active. A mechanical lookup is outside the protocol even mid-session.
