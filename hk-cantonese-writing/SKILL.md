---
name: hk-cantonese-writing
description: "Write natural Hong Kong Cantonese for social posts, video scripts, and long-form articles: register control, spoken-vs-written discipline, traditional-character correctness, and a linter that enforces the mechanical rules."
version: 1.0.0
license: "GPL-3.0-or-later"
platforms: [linux, macos]
status: active
metadata:
  hermes:
    tags: [cantonese, writing, hong-kong, content, video-script, editing]
---

# HK Cantonese Writing

Helps you write **Hong Kong Cantonese** that sounds like a person, not a translation.

This skill is about *language*, not about any brand. It carries no house style: no opinions on
emoji, hashtags, length or calls-to-action. Those belong to whatever content skill or persona is
driving. What lives here is the part that is the same whoever is writing.

## When you're unsure, look it up

The word lists here are curated judgement, not lexicography. Two authoritative sources outrank
them — **粵典 words.hk** for whether a word is really said in Cantonese, and **CUHK 粵語審音配詞字庫**
for how a character is pronounced. See `references/dictionaries.md` for which to use when.

If a list in this skill disagrees with them, they win.

The words.hk **word list** is public domain, so it ships with this skill in `data/` and the linter
checks against it automatically. The full dictionary is non-commercial and is not bundled: look it
up on the site. Details in `references/dictionaries.md`.

## Two kinds of rule — know which you're applying

Everything in this skill is tagged **[OBJECTIVE]** or **[PREFERENCE]**. Do not blur them.

- **[OBJECTIVE]** — wrong is wrong. 簡體字 in HK Cantonese, Mandarin grammar in a Cantonese
  sentence, a 語氣詞 that contradicts the mood. Enforce these silently.
- **[PREFERENCE]** — defensible either way, depends on voice and audience. Register level,
  how much English to mix, how formal to be. **Surface these, don't impose them.** A user's own
  style rules always beat this skill's defaults.

Getting this backwards is the main way a writing skill becomes annoying.

## Start here: three questions

Before writing or editing anything, settle these. They determine every later choice.

1. **Medium** — read on a screen, heard aloud, read at length, or *said to one person*?
   → `references/social-posts.md` · `references/video-scripts.md` · `references/long-form.md` ·
   `references/conversation.md`

   The fourth is easy to forget: an **AI assistant replying to a user** is writing Cantonese too,
   and it's where 簡體字 and 書面語 slip through most, because nobody proofreads a chat message.
   The character and 口語 rules apply to *all* output — replies, status reports, error messages,
   summaries — not only to published content.
2. **Register** — where on the dial, L1 to L5?
   → `references/register.md`. Ask if it isn't obvious; guessing produces bland L2 mush.
3. **Who's talking, to whom?** A brand account, a person, a narrator. Affects 語氣詞 density and
   how much slang is earned.

## The core discipline: 口語 over 書面語

The single most common failure in written Cantonese is **書面語 leaking in** — sentences that are
really Standard Written Chinese in Cantonese clothing. It reads stiff and slightly foreign.

**Test:** read each sentence aloud. If you wouldn't *say* it to a friend, it's 書面語. Rewrite.

When the read-aloud test is inconclusive — you're unsure whether a word is genuinely spoken —
check it on **words.hk**. A word with a Cantonese definition and natural example usage is spoken
Cantonese; one that appears only as a gloss for a 書面語 term is a leak.

The slip is usually **one word inside an otherwise-fine sentence** — most often a verb. Check
word-by-word, not phrase-by-phrase.

```
✗ 記得關掉電腦先走      ← 關掉 is 書面語
✓ 記得熄咗部電腦先走

✗ 拔走條網線           ← 拔 is 書面語; 插頭/網線 themselves are fine
✓ 掹走條網線
```

Full method and word list: `references/spoken-vs-written.md`. **[OBJECTIVE]** for the grammar
words (係/嘅/唔/冇/佢/哋), **[PREFERENCE]** at the margins — some writers keep a slightly higher
register on purpose.

## Characters

**繁體字 only. [OBJECTIVE]** Simplified characters in HK Cantonese are an error, not a variant.
Mixing a few into otherwise-traditional text reads worse than writing entirely in simplified,
because it looks careless rather than deliberate.

HK also differs from Taiwan on some traditional forms (裏/裡, 着/著). See `references/characters.md`.

## Register

Five levels, L1 formal to L5 粗口. Two tests decide whether a sharp word belongs:

1. **Target** — sharp words describe a bad actor's behaviour. Aiming one at a product you admire,
   or at your own reader, misfires regardless of level.
2. **Reshare** — if a reader forwarded this line onward, would it embarrass them?

Full dial, with what each level licenses: `references/register.md`.

## Clarity pitfalls

Independent of register or medium — see `references/pitfalls.md`:

- **Ambiguous idioms.** 「幾歲人都可以中招」 reads as "people of any age, including children",
  which is rarely what's meant. 「識嘢都中招」 or 「老貓燒鬚」 say it cleanly.
- **Acronyms and obscure names.** If a general reader wouldn't recognise it, describe what it does
  instead of naming it.
- **Dark-humour phrasing that lands wrong.** 「搞掂自己」 reads as self-harm. Check the second
  meaning before you keep the joke.

## Lint before you ship

```bash
node scripts/lint-cantonese.mjs <file> --profile post|script|longform|conversation
```

Catches the mechanical rules: 簡體字, 書面語 markers, medium-specific problems. Register is not one
of them: the linter only holds you to the ceiling you set yourself in the profile.

Exit 1 means fix it. It cannot judge whether the writing is *good* — that's still your job.

It also checks every word against 粵典's headword list (`check_unknown_words`). A word 粵典 does not
know, but Standard Written Chinese does, is flagged as a likely 書面語 leak. This is the check that
catches the slips the hand-written lists miss, like 「載入」.

Always **WARN, never FAIL**: 粵典 is a dictionary of *spoken* Cantonese, so some legitimate written
vocabulary (用戶, 帳戶) is genuinely absent. A hit means "read this one aloud", not "this is wrong".

Refresh the bundled data with `node scripts/fetch-dictionaries.mjs`.

Profiles are config, not code: `scripts/profiles/*.json`. Copy one and edit it for your own house
style rather than modifying the skill.

## What this skill will not do

- **Impose a house style.** No emoji/hashtag/length/CTA rules — they aren't language rules.
- **Tell you what makes content good.** Post shape, hooks, openings, pacing, retention, what to
  write about — all content craft, all the caller's business. This skill was carrying some of that
  until 2026-09-09; it had been copied in from a content skill and immediately started drifting.
  If you're adding a rule and can't state it as a fact about *the Cantonese language*, it belongs
  in your content skill instead.
- **Write 書面語 for you.** If you need Standard Written Chinese, this is the wrong skill.
- **Handle 簡體 / mainland platforms.** Out of scope by design; the character and register
  assumptions here are HK-specific and would be actively wrong there.
- **Guarantee taste.** It enforces correctness and flags risk. Voice is yours.

## Using this as assistant instructions

`references/conversation.md` is written to be loaded into an assistant's own system prompt or
persona file, not just consulted before writing. If your agent talks to people in Cantonese, that
file is the language contract — put it somewhere always in scope, not inside a task-specific skill
that only loads sometimes.
