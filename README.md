# 0xdevant Skills (Public)

> Portable agent skills by 0xdevant. No platform lock-in.

Every skill is a **self-contained folder** with a `SKILL.md` — a name, a description
of when to use it, and instructions in plain markdown. Any coding agent that can read
a local folder can use them. Skills that ship scripts use plain Node with zero
dependencies, so there is nothing to build and no runtime tied to a particular client.

---

## Install & use

### Ask your agent (works anywhere)

Paste this into any agent with shell access, replacing `<skill-name>`:

```text
Install the "<skill-name>" skill from https://github.com/0xdevant/agent-skills

1. Clone the repo to a temp directory (or `git pull` if you already have it).
2. Copy the `<skill-name>/` folder into wherever you load skills from.
   If you have a dedicated skills directory, use it. Common ones:
     Claude Code  ${CLAUDE_CONFIG_DIR:-~/.claude}/skills/<skill-name>/
     Cursor       ~/.cursor/skills/<skill-name>/
   If you have no such directory, keep the folder somewhere stable and read its
   SKILL.md when the task matches its description.
   Use `rsync -a --delete`, not `cp -r` — cp nests the folder on re-install.
3. Read the skill's SKILL.md and README.md, then confirm it loaded and tell me
   what it does and how to invoke it.
```

### Or install it yourself

```bash
git clone https://github.com/0xdevant/agent-skills
rsync -a --delete agent-skills/<skill-name>/ <your-skills-dir>/<skill-name>/
```

| Agent | Personal skills directory |
| ----- | ------------------------- |
| Claude Code | `${CLAUDE_CONFIG_DIR:-~/.claude}/skills/<skill-name>/` |
| Cursor | `~/.cursor/skills/<skill-name>/` |
| Anything else | Check your agent's docs for its skills, rules, or instructions directory |

**No skills directory?** These still work. Clone the repo somewhere stable and point
your agent at the folder — the `SKILL.md` is self-describing, so "read
`<path>/SKILL.md` and follow it" is enough. Skills with scripts can also be run
directly from the clone; see each skill's README.

Skills that ship scripts state their runtime requirements in their own README. None
of them need a build step or `npm install`.

---

## Skills

| Skill | Description |
| ----- | ----------- |
| [smart-contract-development](smart-contract-development/) | Designs, implements, audits, and refactors Solidity with a security-first mindset. |
| [token-usage-audit](token-usage-audit/) | Audits and reduces AI coding-agent token spend from local logs, then proves the saving with a before/after benchmark. Works with any model (Claude, GPT, Gemini, local). |

---

## License

MIT
