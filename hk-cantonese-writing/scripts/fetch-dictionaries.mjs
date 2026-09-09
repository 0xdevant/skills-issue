#!/usr/bin/env node
// Regenerates data/*.txt from their upstream sources.
//
//   node scripts/fetch-dictionaries.mjs
//
// Both sources are redistributable; see data/NOTICE.md for licences. The generated
// files are committed, so you only need this when refreshing them.
//
//   粵典 words.hk word list   https://words.hk/faiman/analysis/wordslist/   public domain
//   CC-CEDICT                 https://www.mdbg.net/chinese/dictionary?page=cedict  CC BY-SA 4.0

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const HAN_ONLY = /^[㐀-䶿一-鿿豈-﫿]+$/;

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// 粵典: every headword, any length. Used to segment text and to ask "is this said in Cantonese?"
const words = Object.keys(JSON.parse(
  (await get('https://words.hk/faiman/analysis/wordslist.json')).toString('utf8'),
)).filter((w) => HAN_ONLY.test(w)).sort();
writeFileSync(join(DATA, 'words-hk.txt'), words.join('\n') + '\n');
console.log(`words-hk.txt        ${words.length} entries`);

// CC-CEDICT traditional headwords. Only 2-4 characters: the scan compares short runs,
// so longer entries can never fire and would just be dead weight.
const cedict = gunzipSync(
  await get('https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'),
).toString('utf8');
const swc = [...new Set(
  cedict.split('\n')
    .filter((l) => l && l[0] !== '#')
    .map((l) => l.split(' ')[0])
    .filter((w) => w.length >= 2 && w.length <= 4 && HAN_ONLY.test(w)),
)].sort();
writeFileSync(join(DATA, 'swc-headwords.txt'), swc.join('\n') + '\n');
console.log(`swc-headwords.txt   ${swc.length} entries`);
