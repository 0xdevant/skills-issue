# Video and spoken scripts

A script is **speech**, not text that happens to be read out. The rules that carry over from
writing are the character and 口語 rules; almost everything else changes.

## 語氣詞 carry the tone that punctuation carries in text

This is the biggest difference. Written Cantonese can lean on punctuation, line breaks and
formatting. Speech can't — sentence-final particles do that work. Strip them and a script sounds
like a news bulletin read by someone who doesn't want to be there.

| Particle | Does what | Example |
|---|---|---|
| 啦 | suggestion, softened imperative, "so just…" | 走啦 · 唔使諗啦 |
| 喇 | change of state, "now it's…" | 夠喇 · 好喇，講返正題 |
| 㗎 | assertion, "it is in fact" | 係㗎 · 真係work㗎 |
| 嘅 | assertive/nominalising close | 唔會有事嘅 |
| 囉 | obviousness, mild resignation | 咪係囉 |
| 嘛 | "as you'd expect", appeals to shared knowledge | 佢新嚟嘛 |
| 喎 | reported speech, mild surprise | 佢話唔嚟喎 |
| 添 | "and additionally", often a punchline | 仲要收你錢添 |
| 啫 | "only, merely", downplaying | 一個啫 |
| 咩 | yes/no question with surprise | 係咩？ |

**Density is register.** L1 barely uses them; L3–L4 use them constantly. Adjusting particle
density is the fastest way to move a script's register without rewriting content.

**Don't stack them randomly.** Combinations are real (㗎啦, 咯喎, 嘅啫) but they carry specific
meanings. If unsure, use one.

## Breath and line length

Write for the lungs. A sentence that reads fine can be unspeakable.

- **Aim for 10–20 characters per spoken line.** Longer needs a deliberate breath point.
- **Front-load the subject.** Long subordinate clauses before the main verb are a written-language
  move; in speech the listener has lost the thread by the time the verb arrives.
- **One idea per sentence.** In text a reader can re-read. A listener can't.
- **Read it out loud at delivery speed and time it.** Roughly 4–5 Cantonese characters per second
  for conversational narration. If you run out of breath, the line is too long — split it.

```
✗ 因為佢哋喺上個月已經將成個系統由舊平台搬咗去新平台，所以而家先會出現呢個問題。
✓ 佢哋上個月搬咗成個系統過新平台。
  所以先會有而家呢個問題。
```

## Sounds-the-same problems

Text disambiguates by character; speech can't. Watch for:

- **Numbers that matter.** Say them the way they're spoken: 「一萬四千」 not 「14,000」;
  「九月一號」 not 「1/9」. Write out how you want it said — the reader shouldn't have to decide.
- **Digits with unlucky readings** in commercial contexts (四). Not superstition on your part —
  your audience hears it.
- **Ambiguous short compounds.** If a two-syllable word could be heard as another common word,
  add a syllable of context rather than trusting the listener.
- **English acronyms spelled out.** Decide and mark whether it's said letter-by-letter or as a
  word, especially when a Cantonese speaker would say it differently than an English one.

## Writing for TTS specifically

If a synthetic voice will read this:

- **Don't rely on 懶音 distinctions** (n-/l-, ng-/zero initial) to carry meaning — many voices
  neutralise them.
- **Spell numbers, dates and currency as words.** TTS number handling in Cantonese is unreliable.
- **Test English code-mixing.** Latin runs inside a Cantonese sentence are where TTS most often
  changes voice, mispronounces, or inserts a pause. Keep them short and common.
- **Punctuation is pacing.** Commas become pauses. Use them for breath, not grammar.
- **Read the output before shipping.** Every time.

## Script mechanics

Kept here because these are about *spoken Cantonese*, not about what makes a video good — script
structure, pacing and retention are content craft and belong to your content skill.

- **Signpost transitions out loud.** 「講返轉頭」「重點嚟喇」. In text a heading does this work; in
  speech there are no headings, so the words have to. This is a language constraint, not a
  stylistic preference.
- **Mark delivery as bracketed notes** — pauses, emphasis, tone shifts — visually distinct from
  spoken text so nobody reads them aloud.
- **Openings carry no 書面語 throat-clearing.** 「大家好，歡迎收看本節目」 is written-register
  formula; if you want a greeting, say one the way a person says it.
