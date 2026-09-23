# 文件：README、install steps、reference copy

The medium nobody plans for. Every skill in a repo needs a Cantonese README row, an install
block, a table cell. It is Cantonese prose, so every 口語 and 繁體字 rule still applies, but
it is **reference copy**: scanned for an answer, not read for a voice.

**Lint with `--profile docs`.** The other profiles expect a story shape that reference copy
does not have.

## Register: L2 neutral, and stay there

Docs sit at **L2 專業口語** and use the *neutral* half of that level (值得留意、不過、認真),
not its sharp half. The reason is structural rather than stylistic: a README has no persona
to earn a voice with. The reader arrived to find out what a thing does.

This is the one medium where **L3 casual is a mistake rather than a preference**. L3 markers
(搞掂, 咁啱, heavy 語氣詞) read as a voice, and a voice in reference copy is noise between the
reader and the answer.

## Do not reach for spoken emphasis

The specific failure: writing a table cell the way you would say it out loud. Emphatic spoken
constructions are L3 flourishes and they inflate a line that should just state the fact.

```
✗ 個 agent 淨係答你問嗰句，多餘嘢一句都唔會加。
✓ 個 agent 淨係答你提出嘅問題，唔會透露多餘嘢。
```

Two things moved, and both are the same mistake:

| | ✗ spoken | ✓ docs | Why |
|---|---|---|---|
| Noun | 你問嗰句 | 你提出嘅問題 | 問嗰句 is how you say it; 提出嘅問題 is how you write it down for someone scanning |
| Verb | 一句都唔會加 | 唔會透露 | 一句都唔會 is emphasis, not information. 透露 names the actual behaviour: it is about not *revealing*, not about not *adding* |

Note the second row is not only register. 透露 is the semantically correct verb for what the
software does. **Reaching for the punchy idiom cost accuracy**, which is the real argument
against spoken emphasis in docs: the emphatic phrase is chosen for its rhythm, so it stops
describing the thing.

**Test:** strip the emphasis and see if the sentence lost meaning. If it only lost force, the
force was decoration and the docs version is the stripped one.

## Still Cantonese, not 書面語

Neutral does not mean formal. The read-aloud test from `spoken-vs-written.md` still governs,
and the grammar words (係/嘅/唔/冇/佢/哋) are **[OBJECTIVE]** here as everywhere.

```
✗ 每個 skill 均為獨立資料夾      ← 書面語, drifted to L1
✓ 每個 skill 都係一個獨立 folder
```

The target is the register of a colleague explaining the repo at their desk: composed, but
still speaking Cantonese.

## English technical terms stay in English

skill, agent, folder, linter, profile, repo, commit. Translating these makes docs *harder* to
scan, because the reader is looking for the word they will type. `check_tech_terms` enforces
the direction (載入 → load); it does not ask you to translate the other way.

## Parallel structure across a table

Rows in one table should share a shape. If one row leads with what the tool does, they all
should. A reader scanning a column is comparing, and an odd row out costs them a re-read.
