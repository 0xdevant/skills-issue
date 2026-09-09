# hk-cantonese-writing

[English](README.md) · **廣東話（香港）**

> 一個 agent skill，幫你寫出啲似人話嘅香港廣東話，唔好似翻譯機出嚟咁。

## 佢想解決咩

好多人寫廣東話，寫寫吓就會溝咗個普通話味嘅詞入去。

句嘢唔係*錯*，佢淨係生硬，好似部機讀緊一張表格咁。

```
✗ 記得關掉電腦先走     <- 關掉 好書面。冇人會咁講嘢。
✓ 記得熄咗部電腦先走    <- 熄 先係人講嘅。
```

呢種嘢你可能覺得好似 **AI 式廣東話**，你冇講錯，AI 寫廣東話十居其九都係咁。

不過佢有個正名，叫**書面語**（syu1 min2 jyu5），即係你喺報紙度睇到嗰種中文。真係講出口嗰種廣東話叫**口語**（hau2 jyu5）。AI 特別易寫成咁，因為佢學嗰啲嘢絕大部分都係書面中文，唔係香港人平時講嘢。

呢個 skill 最主要就係幫你擋住書面語，唔好俾佢溝入你嘅口語。

## 佢查啲咩

三樣嘢，全部都係死板嘢：

1. **書面詞。**即係上面 關掉 嗰種。
2. **簡體字。**寫咗 电脑 而唔係 電腦。香港用開繁體，摻個簡體字入去，讀落好似打錯字。
3. **句子長度**，寫片嘅稿先用到。一句長到一啖氣講唔完。

呢三樣都唔使創意，部機做得晒。交咗俾部機，你就唔使分神，可以專心諗真係要諗嗰啲嘢。

**斯文程度唔喺呢個 list 度。**佢唔係查得出嚟嘅嘢，因為冇一個標準答案。條線係你自己劃嘅，個 linter 淨係幫你睇住條線。下面再講。

## 佢**唔會**做嘅嘢

佢對你寫咩內容**完全冇意見**。Emoji、hashtag、篇嘢寫幾長、擺唔擺 link、要唔要叫人 click，佢一律唔理。

嗰啲係*你自己*嘅風格。呢個 skill 淨係管*語言*。你自己嗰套規矩，擺第二度。

## 點裝

將個 folder copy 去你個 agent 擺 skill 嗰個位：

```bash
cp -r hk-cantonese-writing <your-agent>/skills/writing/
```

要 Node 18 或者以上。乜都唔使 install，冇 dependency。

## 點用

叫你個 agent 讀 `SKILL.md`。佢會先問自己三條問題，跟住先開始寫：

1. **呢篇嘢擺去邊？**Post、片嘅稿、長文，定係傾偈嗰種回覆。
2. **要幾隨便？**睇下面個斯文程度表。
3. **邊個喺度講嘢？**一個 brand、一個人，定係旁白。

出街之前，攞你份草稿嚟查一次。呢個動作叫 **lint**，即係「跑個自動檢查器過一次」：

```bash
node scripts/lint-cantonese.mjs draft.txt   --profile post
node scripts/lint-cantonese.mjs script.txt  --profile script
node scripts/lint-cantonese.mjs article.txt --profile longform
node scripts/lint-cantonese.mjs reply.txt   --profile conversation
```

佢會出兩種嘢：

- **FAIL** 即係壞咗。出街之前一定要改。
- **WARN** 即係「你睇睇佢」。呢啲係判斷題，唔會阻住你。

## 斯文程度

廣東話講嘢有幾斯文，分開幾級，呢個 skill 叫佢哋做 L1 至 L5：

| 級數   | 咩感覺 | 邊度見到                  | 大概係咁講嘢         |
| ------ | ------ | ------------------------- | -------------------- |
| **L1** | 正式   | 政府、法律、硬新聞        | 敬請、並非、因此     |
| **L2** | 專業   | Brand account、解畫       | 值得留意、不過、認真 |
| **L3** | 輕鬆   | Vlog、一個真人喺度出 post | 搞掂、咁啱、正斗     |
| **L4** | 玩嘢   | 搞笑 channel              | 神級、笑死、頂唔順   |
| **L5** | 粗口   | 私人講嘢、小說對白        | 粗口五大（唔列出嚟） |

上面啲例子冇一個係用嚟鬧人嘅。**斯文程度指嘅係你平時講嘢想用咩 tune，唔係你識幾多句粗口。**邊一級都講得出好聽嘅嘢，就算去到 L5，粗口一樣可以攞嚟讚人。

大部分 brand 嘅嘢企喺 **L2**。大部分有個人風格嘅嘢企喺 **L3**。

**冇一級係啱嘅。**呢個係個 tune，唔係啱定錯，睇你個 persona 想點。唯一一個 default 係：正常嚟講你唔會想聽落好無禮貌。過咗呢點，就係你把聲自己話事。

最易中招嗰個位係**爭一級**。爭好遠好易睇得出。爭一級嗰啲，寫嗰個自己睇落仲覺得好正常，所以先至成日漏咗。

用 `register_max_level` 揀你個上限，過咗界就會出 FAIL。詳情喺 `references/register.md`。

## 同字典對一次

呢個 skill 入面擺咗**粵典 words.hk** 個 word list，58,004 個詞。

最犀利係：一個詞如果**粵典入面搵唔到**，但係**書面中文嗰邊有**，咁佢九成就係漏咗入嚟嘅書面語。兩樣夾埋先至算數；淨係查一邊，成日都會響錯，根本用唔落。

手寫嗰啲 word list 捉唔到嘅嘢，就係靠呢一步捉，譬如「載入」。

佢**永遠淨係出 WARN，唔會 FAIL**。因為 words.hk 入面淨係有**講**出嚟嘅廣東話，所以有啲正正常常嘅書面詞（用戶、帳戶）佢真係冇。見到就讀多一次出聲，唔係話你錯咗。

想更新入面啲資料：

```bash
node scripts/fetch-dictionaries.mjs
```

## 改到似返你把聲

啲斯文程度級數同 word list 係**一個人嘅意見，唔係標準**。

可能你啲讀者唔係做 IT，「測試」對佢哋嚟講好正常，唔使改做 test。可能你想書面詞出 WARN 就算，唔好 FAIL。Copy 個 profile 出嚟改：

```bash
cp scripts/profiles/post.json my-style.json
node scripts/lint-cantonese.mjs draft.txt --profile-file my-style.json
```

有呢啲掣俾你扭：

| Key                     | 做咩                                               |
| ----------------------- | -------------------------------------------------- |
| `register_max_level`    | 1 至 5。你要幾斯文。                               |
| `spoken_register`       | `strict` 定 `lenient`。書面詞捉得幾緊。            |
| `check_unknown_words`   | 開定閂同字典對嗰一步。                             |
| `require_pivot`         | 要你寫句「最X係」，即係標出重點嗰招。              |
| `max_chars`             | 最長幾多字。                                       |
| `max_line_chars`        | 淨係寫稿用。一句一啖氣。                           |
| `warn_no_particles`     | 淨係寫稿用。冇語氣詞，讀落唔似人講嘢就出聲。       |
| `warn_digits`           | 淨係寫稿用。長串數字好難讀出口。                   |
| `check_officialese`     | 捉啲公文腔。                                       |
| `check_tech_terms`      | 捉啲譯到似模似樣、但係香港人根本講英文嗰啲技術詞。 |
| `check_aspect_stacking` | 捉「好咗喇」嗰種疊晒助詞。                         |
| `check_connectives`     | 捉「然而」「此外」嗰種書面連接詞。                 |

**改 profile，唔好改個 skill。**咁你先仲有得升級。

## 兩種規矩

每條規矩都有個標籤：

- **[OBJECTIVE]** 即係錯就係錯。簡體字、廣東話句入面用普通話文法詞。呢啲個 skill 會靜靜雞幫你改。
- **[PREFERENCE]** 即係睇你口味。幾輕鬆、溝幾多英文。呢啲佢淨係*擺出嚟*俾你睇，唔會逼你。

你自己嗰套，永遠大過佢啲 default。

## Cover 到邊

**Cover：**香港廣東話。Social post、片同 TTS 嘅稿、長文，仲有 assistant 自己傾偈嗰啲回覆。（`references/conversation.md` 特登寫到可以直接掟入 system prompt。）

**唔 cover：**簡體字同大陸平台。呢度講嘅字同 register，擺去嗰邊唔止唔啱使，仲會啱啱掉轉，所以索性唔做，好過做到半桶水。

書面中文同香港以外嘅廣東話，一樣唔 cover。

## 兩本大過呢個 skill 嘅字典

呢度啲 word list 係一個人嘅判斷，唔係正經字典做出嚟嘅嘢。同下面兩本撞，聽下面兩本：

- **粵典 words.hk**，<https://words.hk/>。呢個詞係咪真係有人咁講，定係書面語？
- **中大 粵語審音配詞字庫**，<https://humanum.arts.cuhk.edu.hk/Lexis/lexi-can/>。呢個字點讀？
  寫片稿同 TTS 就係睇呢本。

## 想幫手改善？

啲 word list 係最有得改、亦都係最個人嗰 part。

**最想收到嗰種：用咗個 skill 之後，啲字讀落仲係怪。**貼返句原文出嚟，講埋你自己會點寫、想換咩詞。一個「應該用 X，唔係 Y」嘅例子，好過十句「呢度怪怪哋」。

呢種最有用，因為個 linter 淨係捉到死板嘢。句嘢似唔似人講嘢，要人先睇得出。

第二有用：個 linter 響咗，但係啲字其實寫得好。即係佢捉錯咗，要改嘅係個 skill，唔係你。

唔同意某個詞擺喺某級？以你把聲嚟講，你好可能係啱嘅。開個 issue，講埋個詞、你覺得應該擺邊級、同你平時寫咩。**擺條 words.hk link 出嚟，快過同人嘈。**字典話個 list 錯，就係個 list 錯。

## License

**GPL-3.0-or-later**，文同 code 一樣。全文喺 `LICENSE`。

點用都得，做生意都得。得一個條件：你改完，**要用返同一個 license 放返出嚟**。

重點係啲 word list。佢係一個人嘅判斷，要俾人指正先會好，copyleft 就係等啲指正留返喺公開度，唔會鎖死喺某個人自己嗰份 copy 入面。

### 入面擺咗嘅資料

| File                     | 邊度嚟             | License      |
| ------------------------ | ------------------ | ------------ |
| `data/words-hk.txt`      | words.hk word list | 公有領域     |
| `data/swc-headwords.txt` | CC-CEDICT          | CC BY-SA 4.0 |

兩個都放得出去。詳情見 `data/NOTICE.md`。
