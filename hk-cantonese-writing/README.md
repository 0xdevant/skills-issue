# hk-cantonese-writing

**English** · [廣東話（香港）](README.zh-HK.md)

> An agent skill that helps you write Hong Kong Cantonese that sounds like a person talking, not like a translation.

## The problem it solves

When people write Cantonese, a Mandarin-flavoured word sneaks in.

The sentence is not *wrong*. It just sounds stiff. Like a robot read it off a form.

```
✗ 記得關掉電腦先走     <- 關掉 is bookish. Nobody says this out loud.
✓ 記得熄咗部電腦先走    <- 熄 is what a real person says.
```

That bookish style has a name: **書面語** (syu1 min2 jyu5), "written language". It is the Chinese you read in a newspaper. Real spoken Cantonese is **口語** (hau2 jyu5), "mouth language".

This skill's main job is keeping 書面語 out of your 口語.

## What it checks

Three things, all of them mechanical:

1. **Bookish words.** The 關掉 problem above.
2. **Simplified characters.** 电脑 instead of 電腦. Hong Kong writes in traditional characters, so a simplified one reads as a typo.
3. **Line length**, for video scripts. A line too long to say in one breath.

None of these need creativity. A computer can catch them. That frees you up to think about the writing that actually matters.

**How refined you sound is deliberately not on that list.** It is not a check, because there is no standard answer.
You draw the line yourself and the linter only holds you to the line you drew. More below.

## What it will NOT do

It has **no opinions about your content**. Nothing about emoji, hashtags, how long a post should be, links, or calls to action.

Those are *your* style. This skill only handles *the language*. Keep your own style rules somewhere else.

## Install

Copy the folder into wherever your agent keeps its skills:

```bash
cp -r hk-cantonese-writing <your-agent>/skills/writing/
```

You need Node 18 or newer. Nothing to install, no dependencies.

## Use it

Tell your agent to read `SKILL.md`. It will ask itself three questions first, then write:

1. **Where is this going?** A post, a video script, a long article, or a chat reply.
2. **How casual?** See the 斯文程度 dial below.
3. **Who is talking?** A brand, a person, a narrator.

Then check your draft before you publish it. This is called **linting**, which just means "run an automatic checker over it":

```bash
node scripts/lint-cantonese.mjs draft.txt   --profile post
node scripts/lint-cantonese.mjs script.txt  --profile script
node scripts/lint-cantonese.mjs article.txt --profile longform
node scripts/lint-cantonese.mjs reply.txt   --profile conversation
```

You get two kinds of complaint:

- **FAIL** means it is broken. Fix it before shipping.
- **WARN** means "have a look at this". It is a judgement call. It will not block you.

## How refined you sound (斯文程度)

Cantonese has levels of politeness. This skill calls them L1 to L5:

| Level | Feel | Where you see it | Sounds roughly like |
|---|---|---|---|
| **L1** | Formal | Government, legal, hard news | 敬請, 並非, 因此 |
| **L2** | Professional | Brand accounts, explainers | 值得留意, 不過, 認真 |
| **L3** | Casual | Vlogs, a real person posting | 搞掂, 咁啱, 正斗 |
| **L4** | Cheeky | Comedy channels | 神級, 笑死, 頂唔順 |
| **L5** | Swearing | Private speech, fiction | the 粗口 五大, not listed here |

None of these examples are for insulting anyone. **The dial is the tune you want to talk in, not
how many insults you know.** Every level can say something nice. Even L5 uses swearing to praise
things.

Most brand writing sits at **L2**. Most personality writing sits at **L3**.

**No level is the correct one.** This is a tune, not a right answer. It depends on the persona. The
only real default is that you normally do not want to sound rude. Past that, it is your voice's call.

The trap is being off by **one** level. Way too rude is easy to spot. One notch too rude still reads fine to the person who wrote it, which is exactly why it slips through.

Set your ceiling with `register_max_level` and anything above it becomes a FAIL. Full detail in `references/register.md`.

## The dictionary check

The skill ships with the real 粵典 words.hk dictionary word list, 58,004 words.

Here is the clever bit. If a word is **missing from the Cantonese dictionary** but **present in a written-Chinese dictionary**, it is almost certainly 書面語 that leaked in. That combination is the signal. Checking against either list on its own is far too noisy to be useful.

This is what catches slips the hand-written lists miss, like 「載入」.

It is always a **WARN, never a FAIL**. words.hk records *spoken* Cantonese, so some perfectly good written words (用戶, 帳戶) are genuinely not in it. A hit means "read this one out loud", not "you are wrong".

To update the bundled data:

```bash
node scripts/fetch-dictionaries.mjs
```

## Make it sound like you

The tone levels and word lists are **one person's opinion, not a standard**.

Maybe your readers are not developers, so 測試 reads perfectly normally to them and does not need to become test. Maybe you want bookish verbs to warn instead of fail. Copy a profile and edit it:

```bash
cp scripts/profiles/post.json my-style.json
node scripts/lint-cantonese.mjs draft.txt --profile-file my-style.json
```

Knobs you can turn:

| Key | What it does |
|---|---|
| `register_max_level` | 1 to 5. How refined you want to sound. |
| `spoken_register` | `strict` or `lenient`. How hard it pushes on bookish verbs. |
| `check_unknown_words` | Turns the dictionary check on or off. |
| `require_pivot` | Wants a 「最X係」 line, the move that marks your key point. |
| `max_chars` | Length cap. |
| `max_line_chars` | Scripts only. One breath per line. |
| `warn_no_particles` | Scripts only. Warns if it reads too flat to say. |
| `warn_digits` | Scripts only. Long numbers are hard to read aloud. |
| `check_officialese` | Catches stiff bureaucratic phrasing. |
| `check_tech_terms` | Catches tech words translated into Chinese that HK people say in English. |
| `check_aspect_stacking` | Catches piled-up particles like 好咗喇. |
| `check_connectives` | Catches bookish joining words like 然而 and 此外. |

**Edit a profile, not the skill.** That way you still get updates.

## Two kinds of rule

Every rule is labelled:

- **[OBJECTIVE]** means wrong is wrong. Simplified characters. Mandarin grammar in a Cantonese sentence. The skill just fixes these quietly.
- **[PREFERENCE]** means it depends on taste. How casual, how much English you mix in. The skill *shows* you these instead of forcing them.

Your own style always beats the skill's defaults.

## What it covers

**Yes:** Hong Kong Cantonese. Social posts, video and text-to-speech scripts, long articles, and an assistant's own chat replies. (`references/conversation.md` is built to drop straight into a system prompt.)

**No:** Simplified characters and mainland platforms. The assumptions here would be actively wrong there, so it is left out on purpose rather than half-done. Also no Standard Written Chinese, and no Cantonese from outside Hong Kong.

## Two dictionaries that outrank this skill

The word lists here are one person's judgement, not proper lexicography. When they disagree with these two, these two win:

- **粵典 words.hk**, <https://words.hk/>. Is this word actually said in Cantonese, or is it 書面語?
- **CUHK 粵語審音配詞字庫**, <https://humanum.arts.cuhk.edu.hk/Lexis/lexi-can/>. How is this character pronounced? This is the one that matters for video scripts and text-to-speech.

## Found a mistake?

The word lists are the most improvable part, and the most personal.

**The report we want most: you used the skill and the writing still reads wrong.** Paste the line,
and say which word you would swap in. One concrete "should be X, not Y" is worth ten "this feels
off" reports.

That kind matters most because the linter only catches mechanical things. Whether a sentence
sounds like a person still takes a person to hear.

Second most useful: the linter fired on writing that is actually fine. That means it is wrong, and
the skill is what needs changing, not your draft.

Disagree with where a word sits on the dial? You are probably right for your own voice. Open an
issue with the word, the level you would put it at, and what you write. **A words.hk link ends the
argument faster than arguing.** If the dictionary contradicts a list here, the list is wrong.

## Licence

**GPL-3.0-or-later**, for the writing and the code. Full text in `LICENSE`.

Use it however you like, including for money. The one condition: if you change it, **share your changes under the same licence**.

The point is the word lists. They are one person's cut. They only get better by being corrected, and copyleft keeps those corrections public instead of locked inside someone's private copy.

### The bundled data

| File | Source | Licence |
|---|---|---|
| `data/words-hk.txt` | words.hk word list | Public domain |
| `data/swc-headwords.txt` | CC-CEDICT | CC BY-SA 4.0 |

Both are free to redistribute. Details in `data/NOTICE.md`.
