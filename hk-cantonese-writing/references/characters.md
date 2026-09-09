# Characters — 繁體字 and HK conventions

## 簡體字 are errors, not variants [OBJECTIVE]

In HK Cantonese content, simplified characters are wrong. Not informal — wrong.

A few simplified characters mixed into otherwise-traditional text is **worse** than writing
entirely in simplified: consistent simplified reads as a deliberate audience choice, while a
scattering reads as carelessness, and readers notice immediately.

The linter enforces this. It is the one rule in this skill with no exceptions and no preference
dimension.

## Frequent offenders

| 簡 | 繁 | | 簡 | 繁 | | 簡 | 繁 |
|---|---|---|---|---|---|---|---|
| 以为 | 以為 | | 网站 | 網站 | | 来 | 來 |
| 解决 | 解決 | | 下载 | 下載 | | 说 | 說 |
| 信息 | 資訊¹ | | 电脑 | 電腦 | | 这 | 這 |
| 用户 | 用戶 | | 软件 | 軟件² | | 个 | 個 |
| 诈骗 | 詐騙 | | 游戏 | 遊戲 | | 们 | 們 |
| 时间 | 時間 | | 视频 | 影片³ | | 吗 | 嗎 |

¹ 信息 is not merely the simplified form — HK usage prefers **資訊** (information) or **訊息**
(a message). Converting it to 信息 in traditional characters is still mainland vocabulary.

² Also: HK says **軟件**, Taiwan says 軟體. Same for 硬件/硬體, 網絡/網路.

³ 視頻 is mainland; HK says **影片** or just **片**.

**The vocabulary point matters as much as the characters.** Character-converting a mainland word
gives you a traditional-looking mainland word. Check the term, not just the glyphs.

## HK vs Taiwan traditional forms [PREFERENCE]

Both are traditional; they differ in places. If you're writing for HK, prefer the HK form:

| HK | TW | Notes |
|---|---|---|
| 裏 | 裡 | HK standard is 裏 (though 裡 is widely seen and not an error) |
| 着 | 著 | HK uses 着 for the verb/aspect marker; 著 for 著作/顯著 |
| 綫 | 線 | HK official forms use 綫; 線 is common in practice and fine |

These are conventions, not correctness. Consistency within a piece matters more than which you pick.

## English in Cantonese text [PREFERENCE]

Code-mixing is **normal** HK speech at every register except L1. Do not purge it:

```
✓ 你個 project 幾時 deadline？
✗ 你個項目幾時到期？          ← technically fine, sounds like a translation
```

Guidance:
- Keep English words people actually say in English (project, deadline, send, book, check, load).
- Don't translate a term into 書面語 just to avoid English — that's usually a downgrade.
- Don't force English in where a Cantonese word is the natural one.
- Watch capitalisation and spacing: 「一個 app」 with spaces around the Latin run.
