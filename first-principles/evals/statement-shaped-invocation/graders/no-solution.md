---
type: llm
weight: 1
---
Fails if the response proposes a solution: an architecture, an integration approach, a product, or
any platform, service, API or vendor the user did not name. The user named only Shopify.

It does NOT fail for restating the user's own request in order to split it into its separate
questions and ask which one they mean. That is the required move for this case, and repeating the
user's own nouns (Shopify, stores, sales data, FAQ, owner) proposes nothing. A response of that
shape, on a different problem, for reference:

> Two things are bundled there and they don't depend on each other: where the data is stored, and
> who is allowed to read it. Which are you asking about?

FAILS if the response does any of these:

- names another commerce platform, a specific API, an SDK, a library or a vendor
- describes how to build either half ("you'd expose a webhook that...", "drop in an embed script")
- picks an approach for them
