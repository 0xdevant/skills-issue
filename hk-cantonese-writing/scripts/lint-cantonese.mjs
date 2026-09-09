#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 clawify.ai
// lint-cantonese.mjs — mechanical checks for HK Cantonese content.
//
//   node scripts/lint-cantonese.mjs <file> [--profile post|script|longform] [--profile-file p.json]
//
// Exit 1 on FAIL, 0 otherwise. WARNs are judgement calls and never change the exit code.
//
// Word lists here are curated judgement, not lexicography. Authoritative sources:
//   粵典 words.hk                 https://words.hk/                — is this word really Cantonese?
//   CUHK 粵語審音配詞字庫          https://humanum.arts.cuhk.edu.hk/Lexis/lexi-can/  — how is it read?
// They outrank these lists. Their data is NOT bundled: words.hk is Non-Commercial
// licensed while this skill is copyleft — vendoring it would be a licence conflict.
//
// SCOPE: language only. This linter has no opinion on emoji, hashtags, links, length or CTAs —
// those are house style. Put them in your own content skill, not here.
//
// The input is ALWAYS a file path. Never paste content or a regex onto the command line: some
// agent runtimes' terminal scanners block commands containing escaped hostnames or alternation
// groups, and the run then stalls on an approval prompt. Every pattern lives in this file.

import { readFileSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: node lint-cantonese.mjs <file> [--profile post|script|longform] [--profile-file <path>]');
  process.exit(2);
}
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

let profile = { name: 'post', register_max_level: 2, spoken_register: 'strict' };
const pf = flag('--profile-file');
const pn = flag('--profile');
try {
  const p = pf ? (isAbsolute(pf) ? pf : join(process.cwd(), pf)) : join(HERE, 'profiles', `${pn || 'post'}.json`);
  profile = { ...profile, ...JSON.parse(readFileSync(p, 'utf8')) };
} catch (e) {
  console.error(`could not load profile: ${e.message}`);
  process.exit(2);
}

let text;
try { text = readFileSync(file, 'utf8'); }
catch (e) { console.error(`cannot read ${file}: ${e.message}`); process.exit(2); }

const findings = [];
const lines = text.split('\n');

function at(idx, token, level, rule, fix) {
  let run = 0;
  for (let i = 0; i < lines.length; i++) {
    const next = run + lines[i].length + 1;
    if (idx < next) return findings.push({ line: i + 1, col: idx - run + 1, idx, len: token.length, token, level, rule, fix });
    run = next;
  }
  findings.push({ line: 0, col: 0, idx, len: token.length, token, level, rule, fix });
}
function scan(list, level, rule, fix) {
  for (const needle of list) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(needle, from);
      if (i === -1) break;
      at(i, needle, level, rule, fix);
      from = i + needle.length;
    }
  }
}
function note(level, rule, fix, token = '(whole file)') {
  findings.push({ line: 0, col: 0, token, level, rule, fix });
}

// ── [OBJECTIVE] simplified characters ────────────────────────────────────────
const SIMPLIFIED = {
  '以为':'以為','解决':'解決','用户':'用戶','诈骗':'詐騙','网站':'網站','下载':'下載',
  '电脑':'電腦','软件':'軟件','游戏':'遊戲','时间':'時間','问题':'問題','东西':'東西',
  '来':'來','说':'說','这':'這','个':'個','们':'們','吗':'嗎','为':'為','决':'決',
  '户':'戶','网':'網','载':'載','电':'電','软':'軟','骗':'騙','诈':'詐','实':'實',
  '现':'現','发':'發','会':'會','没':'沒','样':'樣','应':'應','关':'關','开':'開',
};
for (const [bad, good] of Object.entries(SIMPLIFIED)) {
  scan([bad], 'FAIL', 'simplified character', `use 「${good}」 — 簡體字 are errors in HK Cantonese, not variants.`);
}

// Mainland vocabulary that survives character conversion.
scan(['信息'], 'WARN', 'mainland vocabulary', 'HK prefers 資訊 (information) or 訊息 (a message).');
scan(['視頻'], 'WARN', 'mainland vocabulary', 'HK says 影片 or 片.');
scan(['軟體','硬體','網路'], 'WARN', 'Taiwan vocabulary', 'HK says 軟件 / 硬件 / 網絡.');

// ── [OBJECTIVE] Mandarin grammar words ───────────────────────────────────────
const GRAMMAR = {
  '沒有':'冇','什麼':'咩／乜嘢','怎麼':'點／點樣','為什麼':'點解','我們':'我哋',
  '他們':'佢哋','你們':'你哋','現在':'而家','昨天':'尋日','明天':'聽日','一起':'一齊',
};
for (const [bad, good] of Object.entries(GRAMMAR)) {
  scan([bad], 'FAIL', '書面語 grammar word', `use 「${good}」 — this is Mandarin, not Cantonese.`);
}

// ── [PREFERENCE] 書面語 verbs — severity depends on profile ─────────────────
const VERBS = {
  '關掉':'熄','有空':'得閒','知道':'知','明白':'明','尋找':'搵','回來':'返嚟',
  '睡覺':'瞓','吃飯':'食飯','喝':'飲',
};
const verbLevel = profile.spoken_register === 'lenient' ? 'WARN' : 'FAIL';
for (const [bad, good] of Object.entries(VERBS)) {
  scan([bad], verbLevel, '書面語 verb', `consider 「${good}」. Read the sentence aloud — would you say it?`);
}

// Bare 找 is 書面語 for 搵. 找錢／找數／找贖 are genuine Cantonese (giving change,
// settling a bill), so skip those compounds. 尋找 is caught above and wins by dedup.
const FIND_OK = new Set(['錢', '數', '贖', '續']);
for (let i = text.indexOf('找'); i !== -1; i = text.indexOf('找', i + 1)) {
  if (FIND_OK.has(text[i + 1])) continue;
  at(i, '找', verbLevel, '書面語 verb', 'use 「搵」. 找錢／找數 are fine; the bare verb is not.');
}

// 書面語 modifiers. The tell is not always a verb — a formal qualifier stiffens an
// otherwise-fine sentence, and the fix is usually to delete it rather than swap it.
scan(['硬性'], 'WARN', '書面語 modifier',
  'reads formal. Usually the sentence is better with it deleted: 「捉硬性錯誤」 → 「捉錯」.');

// ── [PREFERENCE] register ────────────────────────────────────────────────────
const REGISTER = {
  5: ['屌','撚','柒','閪','𨳍','冚家'],
  4: ['廢柴','硬膠','on9','On9','ON9','仆街','撲街','賤格'],
  3: ['黐線','衰格'],
};
for (const [lvl, words] of Object.entries(REGISTER)) {
  if (Number(lvl) > (profile.register_max_level ?? 2)) {
    scan(words, 'FAIL', `register above L${profile.register_max_level}`,
      `this is L${lvl} vocabulary. Raise register_max_level in your profile if that's intended.`);
  }
}
if (/最[^\s，。！？]{1,4}(?:係|嘅位)/u.test(text)) {
  note('INFO', '「最X係」 pivot present', 'check the target test: is the sharp word aimed at a bad actor, not a product or the reader?');
} else if (profile.require_pivot) {
  note('WARN', 'no 「最X係」 pivot', 'the pivot carries the striking detail. If you cannot find one, you may not have the story yet.');
}

// ── clarity pitfalls ─────────────────────────────────────────────────────────
scan(['搞掂自己'], 'WARN', 'unintended second meaning', 'reads as "finish yourself off".');
scan(['幾歲人都'], 'WARN', 'ambiguous idiom', 'reads as "any age, including children". Try 識嘢都中招.');
scan(['提高警惕','切勿'], 'WARN', 'PSA tone', 'reads as a government notice.');

// ── medium: script ───────────────────────────────────────────────────────────
if (profile.name === 'script') {
  // 嘅 is deliberately excluded: it is overwhelmingly a possessive/nominaliser
  // (舊嘅平台), so its presence does not show the writer used sentence-final
  // particles at all. Only unambiguously final particles count here.
  const PARTICLES = ['啦','喇','㗎','囉','嘛','喎','添','啫','咩','吖','嗱','噃','嘞'];
  if (profile.warn_no_particles && !PARTICLES.some((p) => text.includes(p))) {
    note('WARN', 'no 語氣詞 anywhere', 'spoken Cantonese carries tone in particles. Without them a script reads like a news bulletin.');
  }
  const max = profile.max_line_chars ?? 20;
  lines.forEach((l, i) => {
    for (const seg of l.split(/[，。！？、；]/)) {
      if ([...seg.trim()].length > max) {
        findings.push({ line: i + 1, col: 1, token: `${[...seg.trim()].length} chars`, level: 'WARN',
          rule: 'line too long to speak', fix: `over ${max} characters without a breath point. Split it.` });
        break;
      }
    }
  });
  if (profile.warn_digits && /\d{4,}/.test(text)) {
    note('WARN', 'bare long number', 'write numbers the way they are spoken (一萬四千), so the reader is not deciding at the mic.');
  }
  if (/\d{1,2}\/\d{1,2}/.test(text)) {
    note('WARN', 'ambiguous date format', 'use 「9月1號」 — a slashed date has no spoken form.');
  }
}

// ── medium: conversation ─────────────────────────────────────────────────────
if (profile.check_officialese) {
  scan(['您'], 'FAIL', '您 is mainland register',
    'HK Cantonese uses 你.');
  const OFFICIALESE = ['敬請','見諒','閣下','未能','有關操作','本人','茲','謹此'];
  scan(OFFICIALESE, 'FAIL', 'officialese',
    'reads as a compliance notice. Say it plainly: 搞唔掂 / 冇權限，行唔到.');
  scan(['已成功','並已','由於'], 'WARN', 'status-report drift',
    'these cluster where a report slides into 書面語. Read it aloud.');
}

// ── [PREFERENCE] 書面語 adjectives and modifiers ──────────────────────────────
// Always WARN, never FAIL. Unlike the verbs, most of these ARE words.hk headwords, so
// check_unknown_words cannot see them; they are a register choice, not an error.
// The value is naming the replacement: knowing 硬邦邦 is wrong does not tell you it is 生硬.
const ADJ = {
  '硬邦邦':'生硬／硬掘掘',
  '漂亮':'靚',
  '聰明':'醒目／叻',
  '骯髒':'污糟',
  '疲倦':'攰',
  '寒冷':'凍',
  '便宜':'平',
  '難看':'核突／樣衰',
  '可怕':'得人驚',
  '厲害':'犀利／勁',
  '容易':'易',
  '困難':'難搞',
  '安靜':'靜雞雞',
  '生氣':'嬲',
};
for (const [bad, good] of Object.entries(ADJ)) {
  scan([bad], 'WARN', '書面語 modifier',
    `consider 「${good}」. Read it aloud. Full table: references/spoken-vs-written.md`);
}

// ── translated technical terms ───────────────────────────────────────────────
// HK speakers say these in English. Flagged in the profiles where it matters.
// WARN not FAIL: for a general (non-technical) HK audience the Chinese term can
// be the right call — but for developer-facing writing it almost never is.
if (profile.check_tech_terms) {
  const TECH = {
    '部署':'deploy','提交':'commit','分支':'branch','權杖':'token','重試':'retry',
    '快取':'cache','應用程式介面':'API','終端機':'terminal','儲存庫':'repo',
    '除錯':'debug','端點':'endpoint','指令碼':'script','編譯':'compile','容器':'container',
    // Confirmed by a HK developer 2026-09-09: these have natural-sounding Chinese
    // forms, which is exactly why they slip in — but the spoken form is English.
    '測試':'test','伺服器':'server','資料庫':'database','檔案':'file','資料夾':'folder',
    '錯誤':'error','設定':'setting','載入':'load',
  };
  for (const [zh, en] of Object.entries(TECH)) {
    scan([zh], 'WARN', 'translated technical term',
      `a HK speaker says 「${en}」. Fixing sentence register but leaving a translated term is the most common half-fix. Unsure? Check words.hk.`);
  }
}

// ── stacked aspect markers ───────────────────────────────────────────────────
if (profile.check_aspect_stacking) {
  scan(['好咗喇','咗好喇','咗晒喇'], 'WARN', 'stacked aspect markers',
    'one marker usually carries it — 「好喇」 already says it is done.');
}

// ── medium: longform ─────────────────────────────────────────────────────────
if (profile.check_connectives) {
  const CONN = { '然而':'但係／不過','此外':'仲有／另外','由於':'因為','總括而言':'講到尾／總之','首先':'第一' };
  for (const [bad, good] of Object.entries(CONN)) {
    scan([bad], 'WARN', '書面語 connective', `consider 「${good}」 — connectives are where long-form register drifts.`);
  }
}

// ── dictionary check: words that are not Cantonese ───────────────────────────
// Segments the text against 粵典's headword list, then looks at the leftovers. A short
// run that 粵典 does not know, but CC-CEDICT does, is 書面語 that has leaked in. That
// combination is the signal; either list alone is far too noisy to use.
//
// WARN, never FAIL: 粵典 is a dictionary of *spoken* Cantonese, so some legitimate
// written-register vocabulary (用戶, 帳戶) is genuinely absent. Treat a hit as
// "read this one aloud", not as an error. Data and licences: data/NOTICE.md.
if (profile.check_unknown_words) {
  const load = (f) => new Set(readFileSync(join(HERE, '..', 'data', f), 'utf8').split('\n').filter(Boolean));
  let CANTO, SWC;
  try { CANTO = load('words-hk.txt'); SWC = load('swc-headwords.txt'); }
  catch (e) { console.error(`could not load dictionary data: ${e.message}\nrun: node scripts/fetch-dictionaries.mjs`); process.exit(2); }

  // 量詞 constructions (一個, 每層) are grammar, not vocabulary, so they are never
  // headwords in either dictionary. Skip them rather than reporting them forever.
  const DET = new Set([...'一二兩三四五六七八九十幾每多呢嗰成整半好第上下前後今聽尋']);
  const CLF = new Set([...'個隻條份樣層次種啲位架部本張塊件班圍餐日年月排堆篇道口杯碗句頁封棚鋪']);
  const isClassifier = (w) => w.length === 2 && DET.has(w[0]) && CLF.has(w[1]);

  const MAXW = 8;
  for (const m of text.matchAll(/[㐀-䶿一-鿿豈-﫿]+/g)) {
    const run = m[0];
    // max-match segmentation; tokens 粵典 cannot cover come out as single characters
    const toks = [];
    for (let i = 0; i < run.length; ) {
      let hit = null;
      for (let L = Math.min(MAXW, run.length - i); L >= 2; L--) {
        const c = run.slice(i, i + L);
        if (CANTO.has(c)) { hit = c; break; }
      }
      toks.push({ at: i, len: hit ? hit.length : 1, single: !hit });
      i += hit ? hit.length : 1;
    }
    // slide 2-4 char windows over each stretch of consecutive unmatched singles
    for (let s = 0; s < toks.length; ) {
      if (!toks[s].single) { s++; continue; }
      let e = s;
      while (e + 1 < toks.length && toks[e + 1].single) e++;
      const from = toks[s].at, to = toks[e].at + 1;
      for (let i = from; i < to; ) {
        let found = null;
        for (let L = Math.min(4, to - i); L >= 2; L--) {
          const w = run.slice(i, i + L);
          if (!CANTO.has(w) && SWC.has(w) && !isClassifier(w)) { found = w; break; }
        }
        if (found) {
          at(m.index + i, found, 'WARN', 'not in 粵典',
            `「${found}」 is not a words.hk headword but is a Standard Written Chinese word, so likely 書面語. Read it aloud; if you would not say it, rewrite. Check: https://words.hk/`);
          i += found.length;
        } else i++;
      }
      s = e + 1;
    }
  }
}

// ── length (house style; only if the profile sets it) ────────────────────────
const chars = [...text.trim()].length;
if (profile.max_chars && chars > profile.max_chars) {
  note('WARN', `over ${profile.max_chars} characters`, `${chars} characters.`);
}

// ── report ───────────────────────────────────────────────────────────────────
const kept = findings.filter((f) => !findings.some((g) =>
  g !== f && g.idx !== undefined && f.idx !== undefined &&
  g.idx <= f.idx && g.idx + g.len >= f.idx + f.len && g.len > f.len));

const order = { FAIL: 0, WARN: 1, INFO: 2 };
kept.sort((a, b) => (order[a.level] - order[b.level]) || (a.line - b.line));

for (const f of kept) {
  const where = f.line ? `${f.line}:${f.col}` : '-';
  console.log(`${f.level.padEnd(4)} ${where.padStart(6)}  ${f.token}`);
  console.log(`       ${f.rule} — ${f.fix}`);
}
const fails = kept.filter((f) => f.level === 'FAIL').length;
const warns = kept.filter((f) => f.level === 'WARN').length;
console.log(`\n[${profile.name}] ${chars} chars · ${fails} FAIL · ${warns} WARN`);
if (fails) { console.log('Fix every FAIL before shipping.'); process.exit(1); }
console.log(warns ? 'No hard failures. Read the WARNs — they are judgement calls.' : 'Clean.');
