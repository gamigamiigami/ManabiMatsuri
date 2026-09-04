#!/usr/bin/env node
// ============================================================================
// check-deployed.mjs — 公開されてゐる中身が、手元のものと同じか確かめる
// ============================================================================
//
// ■ なぜ要るのか
//   この作業場からは *.github.io へ出られない（組織の送信方針による拒否で、
//   迂回してはならない種類のもの）。つまり配信中の頁を直に開いて
//   目で確かめる事ができない。
//
//   だが、この site はビルドを持たない素の静的サイトである。
//   GitHub Pages が配るのは、公開ブランチに載つてゐるファイルそのもの。
//   そして raw.githubusercontent.com へは出られる。
//   ならば「公開ブランチの中身」を取り寄せて手元と突き合はせれば、
//   配信されてゐる中身が意図どほりかを、こちらで確かめられる。
//
//   これが一致してゐれば、いつも走らせてゐる通しの試験
//   （tools/smoke.mjs）は、そのまま公開中の中身の試験でもある事になる。
//
// ■ これで分からない事（正直に書いておく）
//   GitHub Pages 自身の配信の状態は見えない。Pages が止められてゐる、
//   あるいは古い版を配り続けてゐる、といふ事はこの検査では捕まらない。
//   そこだけは、人が一度ブラウザで開いて確かめる必要がある。
//
// 使ひ方:  node v2/tools/check-deployed.mjs [ブランチ名]
//          既定は公開ブランチ（origin の HEAD、無ければ下の既定値）。
// ============================================================================

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const v2Root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(v2Root, '..');

const DEFAULT_BRANCH = 'claude/handoff-docs-review-8qemhk';
const branch = process.argv[2] || DEFAULT_BRANCH;

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf-8' }).trim();
}

// owner/repo を remote から取り出す
const remote = git('remote', 'get-url', 'origin');
const m = /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(remote);
if (!m) {
  console.error('origin の URL から owner/repo を読み取れません:', remote);
  process.exit(1);
}
const [, owner, repo] = m;

// v2 配下で git が追跡してゐるファイルを対象にする。
// -z を使ふのは、日本語のファイル名が八進のエスケープに化けるのを避けるため
// （既定の ls-files は非 ASCII を "\346\261\272..." の形で引用符に包んで出す）。
const files = execFileSync('git', ['ls-files', '-z', 'v2'], { cwd: repoRoot })
  .toString('utf-8')
  .split('\0')
  .filter(Boolean);
if (files.length === 0) {
  console.error('v2 配下に追跡中のファイルがありません。');
  process.exit(1);
}

console.log(`公開ブランチ ${branch} の ${files.length} ファイルを取り寄せて突き合はせます…\n`);

const same = [];
const differ = [];
const missing = [];
const failed = [];

// 一度に何十本も開かず、少しづつ。相手も此方も無理をしない。
const CHUNK = 8;
for (let i = 0; i < files.length; i += CHUNK) {
  const batch = files.slice(i, i + CHUNK);
  await Promise.all(batch.map(async (rel) => {
    const url =
      'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' +
      branch.split('/').map(encodeURIComponent).join('/') + '/' +
      rel.split('/').map(encodeURIComponent).join('/');
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      failed.push({ rel, why: e.message });
      return;
    }
    if (res.status === 404) { missing.push(rel); return; }
    if (!res.ok) { failed.push({ rel, why: 'HTTP ' + res.status }); return; }

    const remoteBuf = Buffer.from(await res.arrayBuffer());
    const localBuf = fs.readFileSync(path.join(repoRoot, rel));
    if (remoteBuf.equals(localBuf)) same.push(rel);
    else differ.push({ rel, remote: remoteBuf.length, local: localBuf.length });
  }));
}

console.log(`一致            ${same.length}`);
if (differ.length) {
  console.log(`\n中身が違ふ      ${differ.length}`);
  for (const d of differ) console.log(`   ${d.rel}   公開 ${d.remote} バイト / 手元 ${d.local} バイト`);
}
if (missing.length) {
  console.log(`\n公開側に無い    ${missing.length}`);
  for (const r of missing) console.log('   ' + r);
}
if (failed.length) {
  console.log(`\n取り寄せに失敗  ${failed.length}`);
  for (const f of failed) console.log(`   ${f.rel}   ${f.why}`);
}

const bad = differ.length + missing.length + failed.length;
if (bad === 0) {
  console.log('\n公開されてゐる中身は、手元のものと同じです。');
  console.log('よつて tools/smoke.mjs の結果は、そのまま公開中の中身についての結果です。');
  console.log('（Pages の配信そのものが止まつてゐないかだけは、人が一度開いて確かめること。）');
} else {
  console.log('\n食ひ違ひがあります。push を忘れてゐないか、合流し忘れてゐないか確かめること。');
}
process.exit(bad === 0 ? 0 : 1);
