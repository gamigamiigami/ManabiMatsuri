#!/usr/bin/env node
// ============================================================================
// check-config-literals.mjs — 組の固有名詞が config.js の外に漏れてゐないか見張る
// ============================================================================
//
// ■ なぜ要るのか
//   組の名（甲組／乙組など）は当日まで変はる前提で企画が動いてゐる。
//   第一回では文言が各ページに散らばり、直前の変更が一箇所だけ漏れる事故が起きた。
//   今回は「config.js を書き換へれば全画面に反映される」ことを設計の約束にしてゐる。
//   その約束を人手の注意力ではなく、この機械に守らせる。
//
// ■ 何を見るか
//   config.js の TEAMS から name / short / romaji / roomName / colorName を集め、
//   v2 配下のコード（html / js / css / mjs）に同じ文字列が直書きされてゐたら落とす。
//   コメント行も対象にする。古びたコメントもまた「ずれ」だからである。
//
// ■ 何を見ないか
//   ・js/config.js 自身（唯一の出所）
//   ・js/vendor/（同梱ライブラリ）
//   ・design/（Claude Design の画面案。実装ではなく資料なのでそのまま残す）
//   ・*.md（README は運営向けの手引きで、組の名を書いてよい）
//   ・idPrefix（'K' / 'O' の一文字は英文中に頻出するため、照合すると誤検知だらけになる）
//
// 使ひ方:  node v2/tools/check-config-literals.mjs
//          見つかれば file:line を出して終了コード 1、無ければ 0。
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const v2Root = path.join(path.dirname(__filename), '..');

// 検査対象の拡張子。画像や PDF を読んでも意味がないので絞る。
const CODE_EXT = new Set(['.html', '.js', '.mjs', '.css', '.sql']);

// config.js が無くても意味のある最低限の見張り。
// 企画で実際に使ふ語をここに直書きしてあるのは、
// 「config.js ごと壊れてゐても素通りさせない」ための保険である。
const FALLBACK_PATTERNS = [/甲組/, /乙組/, /Team K/, /Kō/];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor' || entry.name === 'design' || entry.name === 'node_modules' || entry.name === 'out') continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

async function loadConfig() {
  const url = new URL('../js/config.js', import.meta.url);
  if (!fs.existsSync(fileURLToPath(url))) return null;
  try {
    return (await import(url.href)).CONFIG;
  } catch (err) {
    console.error('config.js を読み込めませんでした:', err.message);
    process.exit(1);
  }
}

const config = await loadConfig();

// 照合する文字列を組み立てる。idPrefix は誤検知源なので入れない。
const literals = new Set();
if (config?.TEAMS) {
  for (const key of config.TEAM_ORDER ?? Object.keys(config.TEAMS)) {
    const t = config.TEAMS[key];
    if (!t) continue;
    for (const field of ['name', 'short', 'romaji', 'roomName', 'colorName']) {
      if (typeof t[field] === 'string' && t[field].length > 0) literals.add(t[field]);
    }
  }
}
if (literals.size === 0) {
  console.error('config.js から組の名を取り出せませんでした。設定の形が変はつてゐないか確認すること。');
  process.exit(1);
}

const configPath = path.join(v2Root, 'js', 'config.js');
const files = walk(v2Root).filter((f) => {
  if (f === configPath || f === __filename) return false;
  return CODE_EXT.has(path.extname(f));
});

const offenders = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    for (const lit of literals) {
      if (line.includes(lit)) offenders.push({ file, line: i + 1, lit, text: line.trim().slice(0, 120) });
    }
    for (const re of FALLBACK_PATTERNS) {
      const m = re.exec(line);
      if (m && !offenders.some((o) => o.file === file && o.line === i + 1)) {
        offenders.push({ file, line: i + 1, lit: m[0], text: line.trim().slice(0, 120) });
      }
    }
  });
}

if (offenders.length > 0) {
  console.error(`\n組の名が config.js の外に直書きされてゐます（${offenders.length} 件）:\n`);
  for (const o of offenders) {
    console.error(`  ${path.relative(v2Root, o.file)}:${o.line}  「${o.lit}」`);
    console.error(`    ${o.text}`);
  }
  console.error('\n直し方: 文言は ui.js の teamText() か CONFIG 経由で組み立てること。');
  process.exit(1);
}

console.log(`検査 ${files.length} ファイル / 照合語 ${[...literals].join('・')} — 直書きなし。`);
