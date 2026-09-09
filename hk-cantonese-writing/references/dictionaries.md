# Reference dictionaries

The word lists in this skill are **curated judgement**, not lexicography. Two authoritative HK
Cantonese resources outrank them. When a list here disagrees with either, the dictionary wins.

## 粵典 words.hk — <https://words.hk/>

Crowd-sourced but heavily edited Cantonese dictionary. Entries carry jyutping, character variants,
definitions written *in* Cantonese, and usage notes.

**Use it for the question this skill cares about most: is this word actually said in Cantonese, or
is it 書面語?** If a word has a Cantonese definition and natural example usage, it's spoken
Cantonese. If it only appears as a gloss for a 書面語 term, you've found a leak.

Also settles:
- Whether a colloquial word exists at all, or you half-remembered it
- Which character is standard for a spoken morpheme (掹 vs 猛, 嘅 vs 既)
- Rough register — vulgar and slang entries are usually marked

## 粵語審音配詞字庫 (CUHK Lexis) — <https://humanum.arts.cuhk.edu.hk/Lexis/lexi-can/>

CUHK's character-level pronunciation database — "word-formations, phonologically disambiguated
according to the Cantonese dialect". Character-first rather than word-first, with audio.

**Use it for how something will be *read aloud*.** That makes it the script writer's tool:

- A character with multiple readings, where the wrong one changes the meaning
- 正音 questions — which reading is standard rather than 懶音
- What words a character appears in, to check a coinage sounds like something real

For **video and TTS scripts** (`video-scripts.md`) this is the more useful of the two: it tells you
what the voice will actually say, which is the thing you cannot check by reading silently.

## Which one

| Question | Go to |
|---|---|
| Is this word Cantonese or 書面語? | words.hk |
| Does this colloquial word exist? | words.hk |
| Which character for this spoken word? | words.hk |
| How is this character pronounced? | CUHK Lexis |
| Which reading is correct here? | CUHK Lexis |
| Will TTS say this the way I mean? | CUHK Lexis |

## Licensing: know which export you mean [OBJECTIVE]

words.hk publishes **two different things** under **two different licences**. Confusing them is
the whole licensing question here.

| Export | Contains | Licence | Bundled here? |
|---|---|---|---|
| [Word list](https://words.hk/faiman/analysis/wordslist/) | headwords + jyutping, no definitions | **public domain** | **yes**, `data/words-hk.txt` |
| [Full dictionary](https://words.hk/faiman/request_data/) | definitions, usage notes, register labels | Non-Commercial Open Data 1.0 | **no** |

**The word list is public domain** ("Data License: public domain. Credits to words.hk appreciated"
/ 「授權：公有領域。」), so it ships with this skill and powers the linter's `check_unknown_words`
rule. Credit words.hk if you reuse it.

**The full dictionary is non-commercial.** This skill is GPL-3.0-or-later, which grants commercial
rights, and GPL-3 section 7 forbids adding restrictions on downstream users, so a maintainer
cannot bundle NC data and promise nobody will use it commercially. That promise is unenforceable
by construction. Consult the full dictionary, link to it, never vendor it.

The same split applies to CUHK Lexis: check its terms before redistributing anything from it.

`data/swc-headwords.txt` is CC-CEDICT (CC BY-SA 4.0, one-way compatible with GPL-3), used only as
a negative signal. Full provenance for both files: `data/NOTICE.md`; regenerate with
`scripts/fetch-dictionaries.mjs`.

## Reporting a disagreement

If this skill's lists contradict a dictionary, the skill is wrong. Open an issue with the word, the
dictionary link, and the kind of content you write — the register placements especially are one
person's cut and benefit from correction.
