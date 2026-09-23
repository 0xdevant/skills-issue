---
type: llm
weight: 1
---
Invoking the skill IS the asking, so a statement, a want or a fragment is a valid request. This
grader is only about whether the response complains about the SENTENCE FORM.

FAILS only if the response says something of this kind:

- "You haven't actually asked a question."
- "That's a statement, not a question."
- "Rephrase that as a question and I'll help."
- any other remark that the user's input was the wrong grammatical shape

Everything else passes. In particular, saying that the CONTENT contains several distinct questions
and asking which one they mean is the required move for this case, not a complaint. A response of
that shape, on a different problem, for reference:

> Two things are bundled there and they don't depend on each other: where the data is stored, and
> who is allowed to read it. Which are you asking about?

Words like "tangled", "bundled", "two problems", "separate questions" describe the content, not the
grammar. Do not fail the response for using them.
