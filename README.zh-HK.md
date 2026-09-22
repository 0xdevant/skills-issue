# Agent Skills

> 可以搬嚟搬去嘅 agent skills。唔綁死喺任何一個平台。

[English](README.md) · **廣東話（香港）**

每個 skill 都係一個自己一個 folder 就搞掂嘅嘢，入面有個 `SKILL.md`：做咩用、幾時用、點做，全部
用普通 markdown 寫。任何一個讀到本機 folder 嘅 coding agent 都用得。啲 script 淨係用 Node，零
dependency，冇嘢要 build。

## 點裝

將下面呢段擺入任何一個有 shell 權限嘅 agent，記得將 `<skill-name>` 換做你要嗰個：

```text
幫我裝 https://github.com/0xdevant/skills-issue 入面個 "<skill-name>" skill

1. Clone 個 repo 去一個 temp directory（已經有就 `git pull`）。
2. 將 `<skill-name>/` copy 去你 load skills 嗰個位，用 `rsync -a --delete`，
   唔好用 `cp -r`，因為 re-install 嗰陣 cp 會將個 folder 疊多層。
     Claude Code  ${CLAUDE_CONFIG_DIR:-~/.claude}/skills/<skill-name>/
     Cursor       ~/.cursor/skills/<skill-name>/
   冇呢啲 directory？擺個 folder 喺個穩陣位，撞啱個 description 就讀佢個 SKILL.md。
3. 讀埋 SKILL.md 同 README.md，然後同我講佢做咩、同點樣叫佢出嚟。
```

或者自己裝：

```bash
git clone https://github.com/0xdevant/skills-issue
rsync -a --delete skills-issue/<skill-name>/ <your-skills-dir>/<skill-name>/
```

## Skills

| Skill | 做咩 |
| ----- | ---- |
| [token-usage-audit](token-usage-audit/) | 喺本機 log 度睇實同慳返 AI coding agent 嘅 token 開支，再用 before/after benchmark 證明真係慳到。用邊個 model 都得。 |
| [hk-cantonese-writing](hk-cantonese-writing/) | 寫地道嘅香港廣東話，post、稿、長文都得，仲有個 linter 幫你搵錯處。 |
| [first-principles](first-principles/) | 唔畀你將思考外判俾 AI：你問、你講返自己點諗，個 agent 淨係答你提出嘅問題，唔會透露多餘嘢。 |

## 想加嘢入嚟？

睇 [CONTRIBUTING.md](CONTRIBUTING.md)，入面有 skill 嘅結構、frontmatter 慣例，同埋有 script
嘅 skill 要跟嘅規矩。

## 授權

成個 repo 都係 GPL-3.0-or-later。Copyright (c) 2026 0xdevant。全文喺 [LICENSE](LICENSE)。
