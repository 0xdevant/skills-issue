#!/usr/bin/env node
// Structural validation for every skill in this repo. Zero dependencies, Node >= 18.
// Checks what Anthropic's skill-creator validator checks, plus the things it does not:
// directory/name agreement, referenced files existing, and JSON files parsing.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Mirrors skill-creator/scripts/quick_validate.py ALLOWED_PROPERTIES.
const PORTABLE = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);
// Accepted by Claude Code but outside the portable set. Noted, never failed.
const EXTRA = new Set(['disable-model-invocation', 'user-invocable', 'argument-hint', 'version', 'platforms', 'status', 'tools', 'references', 'requires_toolsets', 'required_environment_variables', 'fallback_for_toolsets']);

let failures = 0;
let notes = 0;
const fail = (skill, msg) => { failures++; console.error(`FAIL  ${skill}: ${msg}`); };
const note = (skill, msg) => { notes++; console.log(`note  ${skill}: ${msg}`); };

const skills = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.') && existsSync(join(ROOT, d.name, 'SKILL.md')))
  .map((d) => d.name)
  .sort();

if (skills.length === 0) fail('repo', 'no skill directories found');

for (const skill of skills) {
  const dir = join(ROOT, skill);
  const text = readFileSync(join(dir, 'SKILL.md'), 'utf8');

  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { fail(skill, 'no YAML frontmatter'); continue; }
  const block = fm[1];

  const keys = [...block.matchAll(/^([A-Za-z_-]+):/gm)].map((m) => m[1]);
  for (const k of keys) {
    if (!PORTABLE.has(k) && !EXTRA.has(k)) fail(skill, `unknown frontmatter key '${k}'`);
    else if (!PORTABLE.has(k)) note(skill, `'${k}' is outside the portable set, fine for Claude Code`);
  }

  const name = block.match(/^name:\s*(.+)$/m)?.[1].trim();
  if (!name) fail(skill, "missing 'name'");
  else {
    if (!/^[a-z0-9-]+$/.test(name)) fail(skill, `name '${name}' is not kebab-case`);
    if (name.length > 64) fail(skill, `name is ${name.length} chars, max 64`);
    if (name !== skill) fail(skill, `name '${name}' does not match directory '${skill}'`);
  }

  // description is either inline or a >- / | block of indented lines
  const dm = block.match(/^description:\s*(?:>-|>|\|)\s*\n((?:[ \t]+.*\n?)+)/m)
          || block.match(/^description:\s*(.+)$/m);
  const desc = (dm?.[1] ?? '').replace(/^\s*["']|["']\s*$/g, '').trim();
  if (!desc) fail(skill, "missing 'description'");
  else {
    if (desc.length > 1024) fail(skill, `description is ${desc.length} chars, max 1024`);
    if (/[<>]/.test(desc)) fail(skill, 'description contains angle brackets');
  }

  // Every references/… or scripts/… path named in SKILL.md must exist.
  for (const m of text.matchAll(/`((?:references|scripts|data|evals)\/[\w./-]+)`/g)) {
    if (!existsSync(join(dir, m[1]))) fail(skill, `SKILL.md references missing file '${m[1]}'`);
  }

  // Every JSON file shipped with the skill must parse.
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  for (const f of walk(dir).filter((f) => f.endsWith('.json'))) {
    try { JSON.parse(readFileSync(f, 'utf8')); }
    catch (e) { fail(skill, `invalid JSON in ${f.slice(dir.length + 1)}: ${e.message}`); }
  }

  // A skill listed in the README table is how anyone finds it.
  if (!readFileSync(join(ROOT, 'README.md'), 'utf8').includes(`(${skill}/)`))
    fail(skill, 'not listed in the README skills table');
}

console.log(`\n${skills.length} skills · ${failures} FAIL · ${notes} notes`);
if (failures) process.exit(1);
console.log('All skills structurally valid.');
