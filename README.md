# Agent Skills

> Portable agent skills. No platform lock-in.

**English** · [廣東話（香港）](README.zh-HK.md)

Every skill is a self-contained folder with a `SKILL.md`: what it's for, when to use it, and
instructions in plain markdown. Any coding agent that reads a local folder can use them. Scripts
are plain Node, zero dependencies, nothing to build.

## Install

Paste this into any agent with shell access, replacing `<skill-name>`:

```text
Install the "<skill-name>" skill from https://github.com/0xdevant/skills-issue

1. Clone the repo to a temp directory (or `git pull` if you have it already).
2. Copy `<skill-name>/` into wherever you load skills from, using `rsync -a --delete`,
   not `cp -r`, which nests the folder on re-install.
     Claude Code  ${CLAUDE_CONFIG_DIR:-~/.claude}/skills/<skill-name>/
     Cursor       ~/.cursor/skills/<skill-name>/
   No skills directory? Keep the folder somewhere stable and read its SKILL.md when
   the task matches its description.
3. Read the SKILL.md and README.md, then tell me what it does and how to invoke it.
```

Or do it yourself:

```bash
git clone https://github.com/0xdevant/skills-issue
rsync -a --delete skills-issue/<skill-name>/ <your-skills-dir>/<skill-name>/
```

## Skills

| Skill | Description |
| ----- | ----------- |
| [token-usage-audit](token-usage-audit/) | Audits and reduces AI coding-agent token spend from local logs, then proves the saving with a before/after benchmark. Any model. |
| [hk-cantonese-writing](hk-cantonese-writing/) | Writes natural Hong Kong Cantonese for posts, scripts and articles, with a linter for the mechanical rules. |
| [first-principles](first-principles/) | Stops you outsourcing your reasoning: you ask and describe your model, the agent answers only what you asked and volunteers nothing. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for skill layout, frontmatter conventions, and the rules
for skills that ship scripts.

## License

GPL-3.0-or-later. Copyright (c) 2026 0xdevant. Full text in [LICENSE](LICENSE).
