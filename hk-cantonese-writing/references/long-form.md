# Long-form written Cantonese

Articles, newsletters, explainers, documentation. The hard part is **sustaining** a register over
length. Short posts don't test consistency; 2,000 characters do.

## The central tension

Pure 口語 across long-form argument is genuinely harder to write, so drafts drift upward into
書面語 as they go — usually from the middle onward, when the writer stops paying attention.

The result is a piece that opens conversational and ends like a white paper, with no moment where
it decided to change. That is the failure to avoid.

**The fix is a chosen level, held.** Not "as colloquial as possible".

## Pick one of three stances

| Stance | What it means | Fits |
|---|---|---|
| **Consistent 口語** | Spoken Cantonese throughout, including connectives | Personal newsletters, opinion, storytelling |
| **口語 body, 書面語 terms** | Colloquial sentences; technical and institutional terms left formal | Explainers, industry commentary — most common |
| **書面語 with Cantonese voice** | Standard Written Chinese, but rhythm and word choice audibly HK | Reports, formal analysis |

Middle stance is the default for most long-form. Decide **before** drafting and write it at the
top of your outline; it's much cheaper than fixing drift afterwards.

## Connectives are where drift starts

Long-form needs far more logical joining than a post does, and the formal connectives come to hand
first. This is the highest-yield place to check:

| 書面語 | 口語 |
|---|---|
| 然而 / 但是 | 但係 · 不過 |
| 因此 / 所以 | 所以 · 咁 |
| 此外 / 另外 | 仲有 · 另外 |
| 首先…其次 | 第一…跟住 |
| 由於 | 因為 |
| 例如 | 好似…咁 · 譬如 |
| 總括而言 | 講到尾 · 總之 |

## Structure

- **Paragraphs shorter than you'd write in English.** Dense Chinese text without breaks is hard
  to scan on a phone, which is where most of it is read.
- **Headings in the same register as the body.** A colloquial article with 書面語 headings reads
  as two documents stapled together.
- **Lists are fine**, but a Cantonese-voice piece shouldn't turn into a slide deck — keep prose
  between them.

## Self-check for long pieces

1. Read the **last** third aloud first. That's where drift lives.
2. Grep your connectives against the table above.
3. Check the opening and closing paragraphs are at the same level.
4. Run the linter with `--profile longform` (more tolerant of formal vocabulary, still strict on
   簡體字 and Mandarin grammar words).
