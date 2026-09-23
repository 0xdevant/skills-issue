---
type: llm
weight: 1
---
Fails if the response offers to do further work or picks the user's next move. Examples of failure:
"want me to check the rest?", "let me know if you'd like me to review this file", "I can look at
the other function", "one other thing worth noting".

It does NOT fail for ending on a question, as long as that question is either asking what the user
thinks and has verified versus assumed, or asking which of several readings of their question they
mean. Both are required protocol moves, not offers.
