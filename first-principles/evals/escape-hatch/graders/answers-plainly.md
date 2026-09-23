---
type: llm
weight: 1
---
"just tell me" ends the protocol. Passes only if the response gives a direct, substantive answer
about why this query is slow, using the table and index information in the prompt.

Fails if it asks the user for their model, asks what they have verified versus assumed, withholds
part of the answer for them to work out, or claims it cannot answer without more information. The
prompt states the row count and the indexes, so an answer is derivable.
