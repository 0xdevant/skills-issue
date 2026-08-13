# 0xdevant Skills (Public)

> Public Cursor / Claude Code compatible skills by 0xdevant.

**Supported AI platforms:** [Cursor](https://cursor.com) · [Claude Code](https://claude.ai/download) · clients that load markdown skills from local folders

---

## Install & use

Clone this repository and copy or symlink a skill folder into your local skills directory.

**Cursor (personal skills):** copy or symlink to `~/.cursor/skills/<skill-name>/`.
**Claude Code (personal skills):** copy or symlink to `~/.claude/skills/<skill-name>/`.

### Or ask your agent

Paste this into Claude Code, Cursor, or any agent with shell access, replacing
`<skill-name>` with the skill you want:

```text
Install the "<skill-name>" skill from https://github.com/0xdevant/agent-skills

1. Clone the repo to a temp directory (or `git pull` if you already have it).
2. Copy the `<skill-name>/` folder into my personal skills directory:
   - Claude Code: ${CLAUDE_CONFIG_DIR:-~/.claude}/skills/<skill-name>/
   - Cursor:      ~/.cursor/skills/<skill-name>/
   Use `rsync -a --delete`, not `cp -r` — cp nests the folder on re-install.
3. Read the skill's SKILL.md and README.md, then confirm to me that it loaded
   and tell me what it does and how to invoke it.
```

Skills that ship scripts state their runtime requirements in their own README.
None of them need a build step or `npm install`.

---

## Skills

| Skill | Description |
| ----- | ----------- |
| [smart-contract-development](smart-contract-development/) | Designs, implements, audits, and refactors Solidity with a security-first mindset. |
| [token-usage-audit](token-usage-audit/) | Audits and reduces AI coding-agent token spend from local logs, then proves the saving with a before/after benchmark. Works with any model (Claude, GPT, Gemini, local). |

---

## License

MIT
