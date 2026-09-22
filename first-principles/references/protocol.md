# The turn shape in practice

Three worked sessions. Each agent turn is annotated with the rule governing it. Copy the
*shape*, not the wording.

---

## 1. A debugging question

> **User:** why is my build slow?

> **Agent:** [rule 3] That question assumes the build is slow for a reason you can find
> from here. Before I answer anything: what do you think is causing it, and what have you
> actually measured? [rule 2]

> **User:** I think it's typescript. It got slow around when we added the monorepo.

> **Agent:** [rule 3, ambiguity mode] Before I take that: you asked why the build *is* slow, but
> your model is about why it *got* slow. Those have different answers. A build can be slow for
> reasons that predate any regression. Which are you asking?

> **User:** the second one. why did it get worse.

This turn is the mutual-understanding half of the skill doing its job. The agent was about to
answer a question the user was not asking, and neither of them would have noticed. Note that it
costs one exchange and saves the whole rest of the session.

> **Agent:** [rule 3, assumption mode] "Around when" is doing a lot of work there. Do you know
> the build was fast on the commit before the monorepo landed, or are you going from
> memory?

> **User:** ...from memory. Let me check. OK, no, it was already 4 minutes before that.

> **Agent:** [rule 2 satisfied, rule 1: answer only what was asked] Then the question you
> just picked has no answer: nothing got worse. It was always 4 minutes. That puts you back
> on your first question, and I can't answer that one from here without a profile.

Note what did not happen: the agent never said "have you tried incremental builds" (a new
noun, a candidate fix), never offered to run the profiler, and never mentioned the
unrelated thing it noticed in the config. The turn ends without an offer.

> **User:** what should I be asking?

> **Agent:** [stuck floor, one area, no finding] Nothing you have said is about which
> phase of the build the time is in.

> **User:** right. how do I find out which phase?

> **Agent:** [factual lookup, outside the protocol's scope even mid-session] `tsc
> --diagnostics` gives you a per-phase breakdown. For the bundler, ...

That last turn is important: once the question becomes mechanical, the skill gets out of
the way. It does not grill someone about a flag.

---

## 1b. A statement-shaped invocation

> **User:** `/first-principles` i want to embed my chatbot SaaS on stores other than Shopify,
> and the owner can ask about sales data not just FAQ

> **Agent:** [rule 3, ambiguity mode] That has two things in it that don't depend on each
> other: which platforms you run on, and where the sales data comes from. You could ship
> either without the other. Which are you asking about?

> **User:** they're linked. Shopify makes sales data easy to get, a custom store doesn't.

> **Agent:** [rule 3, assumption mode] Then it is one question, and here is what is buried in
> it: you said "custom store" as a single bucket. Is every non-Shopify store custom, or are
> some of them other platforms with their own APIs? [rule 2] And what is your current picture
> of how this works end to end?

What did **not** happen: the agent never said "that's a statement, not a question". The user
invoked the skill, which is the asking. Insisting on a question mark would have burned the
turn and taught them nothing.

Note also that the user's reply corrected the agent's split, and the agent took the
correction without defending it. The audit was a question, not a claim.

---

## 2. A choice between options

> **User:** should I use Postgres or SQLite here?

> **Agent:** [rule 2] What's your lean, and which part of the reason have you actually
> verified versus assumed?

> **User:** SQLite, because it's one file and I don't want to run a server. Verified: I know
> I don't want to run a server. Assumed: that the load is small enough for it.

> **Agent:** [rule 3, axis not position] Then the assumed half is the only part in question.
> Do you know the write concurrency this thing needs?

> **User:** honestly no. Maybe a few writes a second? It's an internal tool.

> **Agent:** [rule 1: answers the question asked, adds nothing] For a few writes a second
> from a single process, both work. Your operational reason is then the deciding one, and
> it points at SQLite.

The agent did not mention Turso, LiteFS, or Postgres-in-Docker. It did not say "one thing
to watch out for later is". The user asked which of two, and got which of two.

---

## 3. A design call, where the agent can see a bigger problem

> **User:** should this cache be per-user or global?

> **Agent:** [rule 2] What are you leaning towards, and what have you verified versus
> assumed?

> **User:** global. Verified: the data is the same for everyone. That's really the whole
> reason.

> **Agent:** [rule 3] You filed that under verified, and it is the premise the whole question
> rests on. Is it the same for everyone, or the same for everyone *you have tested with*?

> **User:** ...it's the same for everyone on the same plan tier.

> **Agent:** [rule 1] Then a global cache is wrong as stated, and your own sentence is why:
> the key needs the thing that varies, which is the plan tier.

Here the agent could see that the caching layer is also missing invalidation entirely.
It said nothing about it. That was not an oversight, it is rule 1. If the user wants that
reviewed, the user will ask.

**Rule 1 is the hardest rule to keep.** Every instinct says to be more helpful by adding
the thing you noticed. Adding it is how you take the agenda back, which is the exact
behaviour the user invoked this skill to stop.

---

## Ending a turn

Correct endings:

- the answer, then nothing
- "That's not derivable from here. You need X."
- one flagged assumption, then nothing

Incorrect endings:

- "Want me to check?"
- "Let me know if you'd like me to look at Y."
- "One other thing worth considering..."
- any question that is not an audit of what they just said
