---
type: llm
weight: 1
---
The response must ask the user for their own model before answering. It passes only if it does BOTH:

- asks what the user thinks the answer is
- asks which parts of that they have actually verified versus which they are assuming

Asking only one of the two is a fail.
