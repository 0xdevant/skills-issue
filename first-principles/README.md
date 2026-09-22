# first-principles

> You ask. You describe your model. The agent answers exactly that, and volunteers nothing.

## Why

The default way we use AI erodes the thing it is supposed to support. You ask "why is
this broken?", you get a confident answer, you accept it, and over time your own ability
to derive it decays. The answer arrives before you have done any of the work that makes
an answer stick.

The obvious fix is to have the AI interrogate you instead, Socratic style. That does not
work, and it is worth being precise about why: **the agent still sets the agenda.** It
picks the questions, decides what matters, and decides when you are done. You have
delegated the questioning instead of the answering. Same disease, new coat.

So this skill inverts it. Knowing what to ask is the thinking. The skill's whole job is to
refuse to do that part for you.

## It is not vegetables

The obvious objection to a skill like this is that it trades your convenience for your own
good, and skills like that get switched off within a week.

It does not, because the same protocol produces a second thing: **a better spec.** "Why is my
build slow?" tells the agent almost nothing, so it answers the median version of that question.
Rule 2 turns it into "I think it's typescript, it got slow around when we added the monorepo",
which is a hypothesis, a timeline, a stack, and a set of things already ruled out. Now it is
answering *yours*.

Both halves come from the same mechanism:

| | What happens | Who gains |
| --- | --- | --- |
| You state your model | your reasoning gets externalised, so you can see its gaps | you |
| | the agent gets context it was never going to be handed | the agent |
| It audits your question | the buried assumption surfaces | you |
| | the ambiguity gets resolved before an answer is built on it | the agent |

Which is the point: the turns you spend stating a model are turns the agent would otherwise
spend guessing at context it does not have.

## How it differs from [grill-me](https://www.aihero.dev/skills-grill-me)

The roles are swapped, not tweaked:

|  | grill-me | first-principles |
| --- | --- | --- |
| Who asks | the agent | you |
| Who owns the agenda | the agent's question frontier | you, every turn |
| The agent's discipline | ask the whole frontier | answer only what was asked |
| Fires when | you invoke it on a loose idea | you invoke it on something you want to work out |
| Ends when | the frontier empties | you stop asking |
| Output | a committed-to idea | your own reasoning, agent as instrument |

They compose fine. Use grill-me to sharpen an idea you are holding; use this when you
catch yourself asking the machine to work something out on your behalf.

## What it actually does

Four rules, in full in [SKILL.md](SKILL.md):

1. **Answer exactly what was asked.** No bonus scope, no "also worth noting", no next step.
2. **Price of admission.** Before you get an answer, state what you think it is, and split it:
   what have you actually verified, what are you assuming? That split is the first-principles
   move, and it means you cannot fish.
3. **Audit the question, not the answer.** It flags assumptions buried in what you asked.
   It never grades whether your conclusion is right.
4. **No unprompted synthesis.** No summaries, rankings or recommendations unless you ask.

Once you invoke it, it stays on for the conversation and applies to judgment questions (why
is X broken, which option, is this a good idea, design calls). It deliberately stays out of the
way for lookups, mechanical edits, and anything cheap to get wrong, so you can still ask what a
flag does mid-session without being grilled about it.

## Turning it on

```
/first-principles
```

Or just say it: "first principles me", "don't just tell me", "make me work this out".

**It never starts on its own.** An agent that decides you should be made to work for an
answer is insufferable, and it would be this skill's own failure at the outermost level:
the agent picking the agenda again. Most it will do is mention once that a question looks
like a fit, then answer it normally.

The tradeoff is real and worth stating: you have to remember to reach for it, and the
moment you most need it is the moment you least feel like it. That is the price of not
being ambushed on every question.

## Turning it off

Say **"just tell me"** or **"done"**. You get a plain answer immediately, with no
guilt-trip and no partial withholding, and it does not creep back on the next turn. It also
releases on its own if you say you are tired, blocked, or on a deadline.

A skill you cannot switch off gets uninstalled, and then you have nothing.

## When you are stuck

Ask **"what should I be asking?"**. It names one area you have not examined, never a
finding. You still own the agenda, because handing it over for a turn was your move.

## Limits, honestly

- **It is a prompt, not a guarantee.** A sufficiently determined model will drift back
  into being helpful. The [anti-patterns](references/anti-patterns.md) file exists because
  this is expected, not hypothetical.
- **You have to remember to invoke it.** The real cost of a manual trigger: it is off at
  exactly the moments you are most likely to want an answer handed to you. That is the trade
  for not being ambushed on every question, and it is a deliberate one.
- **It cannot stop you opening a fresh session and asking there.** Nothing here is
  enforcement. It is a mode you enter on purpose.
- **It does not make you right.** It makes the reasoning yours. Those are different
  things, and the second one is the only one a prompt can deliver.

## Install

```bash
git clone https://github.com/0xdevant/skills-issue
rsync -a --delete skills-issue/first-principles/ ~/.claude/skills/first-principles/
```

No scripts, no dependencies, no install step. The skill is stateless and writes no files.

## Tests

`evals/evals.json` holds 8 cases and 27 assertions covering the behaviours that are easy to
regress: answering only what was asked, treating a statement as the question, the stuck
floor, the escape hatch, and staying out of the way for mechanical lookups. Case 8 has no
invocation at all and asserts the skill does **not** fire on its own.

They run through Anthropic's `skill-creator` eval loop, which executes each prompt and grades
the assertions. Note that `skill-creator`'s `run_eval.py` tests *description triggering*
specifically, which this skill disables on purpose, so that particular runner is not the
relevant one here.

## License

GPL-3.0-or-later, as with the rest of this repo.
