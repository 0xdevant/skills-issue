# 口語 vs 書面語

The defining discipline of written HK Cantonese. Most drafts that "feel off" are off for this
reason and no other.

## What's actually going wrong

書面語 (Standard Written Chinese) and spoken Cantonese are different languages sharing a script.
A sentence can be entirely valid Chinese, entirely traditional characters, and still be wrong —
because a Hongkonger would never *say* it.

The tell is usually **one word**, not the whole sentence. Most often a verb.

```
✗ 記得關掉電腦先走         ✓ 記得熄咗部電腦先走
✗ 拔走條網線              ✓ 掹走條網線
✗ 我沒有時間              ✓ 我冇時間
✗ 這個問題很難解決         ✓ 呢個問題好難搞
✗ 他們為什麼不回覆         ✓ 佢哋點解唔覆
✗ 幫你捉硬性錯誤           ✓ 幫你捉錯
```

That last one is not a verb: 硬性 is a formal **modifier**, and the fix is to delete it, not to
swap it. When a sentence reads stiff and every verb checks out, look at the qualifiers.

## The method

1. Read the sentence **aloud**. Not in your head — aloud.
2. If you would not say it to a friend, it's 書面語.
3. When it's wrong, find *which word*. Scan word-by-word; don't rewrite the whole line reflexively.
4. Replace or delete only that word. The rest of the sentence is usually fine.

## Core substitutions [OBJECTIVE]

These are grammar words. Getting them wrong isn't a style choice, it's writing Mandarin.

| 書面語 | 口語 | | 書面語 | 口語 |
|---|---|---|---|---|
| 是 | 係 | | 什麼 | 咩／乜嘢 |
| 的 | 嘅 | | 怎麼／怎樣 | 點／點樣 |
| 不 | 唔 | | 為什麼 | 點解 |
| 沒有 | 冇 | | 現在 | 而家 |
| 他／她 | 佢 | | 這 | 呢 |
| 我們 | 我哋 | | 那 | 嗰 |
| 他們 | 佢哋 | | 很 | 好 |
| 給 | 畀 | | 也 | 都 |
| 和 | 同 | | 全部 | 晒（後綴） |

## Common verbs [OBJECTIVE at the core, PREFERENCE at the edges]

| 書面語 | 口語 | | 書面語 | 口語 |
|---|---|---|---|---|
| 吃 | 食 | | 尋找 | 搵 |
| 喝 | 飲 | | 知道 | 知 |
| 睡覺 | 瞓 | | 明白 | 明 |
| 站 | 企 | | 可以 | 得 |
| 關掉 | 熄 | | 有空 | 得閒 |
| 拔 | 掹 | | 回來 | 返嚟 |
| 丟 | 掉／掟 | | 上班／下班 | 返工／收工 |

**找 → 搵.** The bare verb is 書面語; 搵 is what gets said. The exceptions are fixed compounds:
找錢, 找數, 找贖 are genuine Cantonese and the linter skips them.

## Adjectives and modifiers [PREFERENCE]

The method section says "when a sentence reads stiff and every verb checks out, look at the
qualifiers". This is that list.

**The dictionary cannot help you here.** Almost every 書面語 adjective below *is* a words.hk
headword, because Hongkongers do use them, especially in writing. So `check_unknown_words` will
never flag them. They are a matter of how spoken you want to sound, which is why this is
[PREFERENCE] and the linter only ever WARNs.

| 書面語 | 口語 | | 書面語 | 口語 |
|---|---|---|---|---|
| 硬邦邦 | 生硬／硬掘掘 | | 難看 | 核突／樣衰 |
| 漂亮 | 靚 | | 可怕 | 得人驚 |
| 聰明 | 醒目／叻 | | 厲害 | 犀利／勁 |
| 骯髒 | 污糟 | | 容易 | 易 |
| 疲倦 | 攰 | | 困難 | 難搞 |
| 寒冷 | 凍 | | 安靜 | 靜雞雞 |
| 便宜 | 平 | | 生氣 | 嬲 |

**Watch the trap in the first row.** 硬邦邦 is the one entry here that `check_unknown_words` does
catch, because it is genuinely not in 粵典. But knowing a word is wrong does not tell you the right
one: 「好硬」 is grammatical Cantonese and describes a physical object, not stiff prose. 生硬 is the
word. A dictionary that says "no" is not a dictionary that says "use this instead", and that gap is
what this table exists to fill.

## Nouns and time words

| 書面語 | 口語 | | 書面語 | 口語 |
|---|---|---|---|---|
| 東西 | 嘢 | | 昨天 | 尋日 |
| 事情 | 事 | | 今天 | 今日 |
| 一起 | 一齊 | | 明天 | 聽日 |
| 錢包 | 銀包 | | 早上 | 朝早 |

## Where higher register is legitimate

**[PREFERENCE].** Not every 書面語 word is a mistake:

- **Fixed technical and institutional terms.** 私隱條例, 上市公司, 行政長官. Colloquialising these
  sounds wrong, not natural.
- **Established idioms and 四字成語.** 老貓燒鬚, 一勞永逸 read fine in speech.
- **Deliberate tonal contrast** — one formal phrase inside casual text, for irony.
- **L1 formal writing**, where 書面語 constructions are the correct target.

The rule is about *unconscious* leakage. A 書面語 word you chose on purpose, for an effect you can
name, is a style decision.

## Long-form caution

In articles and newsletters the pressure to drift upward is constant, because sustained argument
in pure 口語 is genuinely harder to write. See `long-form.md` — the answer is a consistent chosen
level, not unconscious sliding between two.
