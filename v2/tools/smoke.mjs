#!/usr/bin/env node
// ============================================================================
// smoke.mjs — 八画面を通しで歩いて、壊れてゐないことを確かめる
// ============================================================================
//
// ■ なぜ要るのか
//   この催しは一日きりで、当日に直す時間はない。
//   画面が多く、状態（證・点・相互連携）が絡むので、
//   人手で毎回全部を辿るのは現実的でない。
//   だから「受付から協力フェーズまで」を機械に一度歩かせる。
//
// ■ 前提
//   ・ローカルモード（config.js の SUPABASE.url が空）でのみ走る。
//     本番の Supabase へ書き込んでしまふ事故を防ぐため、
//     設定が入つてゐたら何もせず落ちる。
//   ・ES modules は file:// では読めないので、必ず HTTP で配る。
//
// 使ひ方:  node v2/tools/smoke.mjs [出力先ディレクトリ]
// ============================================================================

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const v2Root = path.join(path.dirname(__filename), '..');
const repoRoot = path.join(v2Root, '..');
const outDir = process.argv[2] || path.join(repoRoot, 'out');
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}/v2/`;

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// --- 前提の確認 -------------------------------------------------------------
const { CONFIG } = await import(path.join(v2Root, 'js/config.js'));
if (CONFIG.SUPABASE.url) {
  console.error('中止: config.js に Supabase の URL が入つてゐます。');
  console.error('この試験は localStorage だけのローカルモード専用です。');
  process.exit(1);
}
const { PUZZLES } = await import(path.join(v2Root, 'js/puzzles.js'));
const rules = await import(path.join(v2Root, 'js/rules.js'));

const TEAM1 = CONFIG.TEAM_ORDER[0];
const TEAM2 = CONFIG.TEAM_ORDER[1];
const ME = CONFIG.TEAMS[TEAM1].idPrefix + '017';
const PARTNER = CONFIG.TEAMS[TEAM2].idPrefix + '042';
const FIRST_CODE = Object.keys(CONFIG.MANUAL_CODES)[0];
const FIRST_Q = CONFIG.MANUAL_CODES[FIRST_CODE].q;

const answerOf = (qid, teamKey) => rules.answerFor(PUZZLES[qid], teamKey);

fs.mkdirSync(outDir, { recursive: true });

// --- 配信サーバ -------------------------------------------------------------
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: repoRoot, stdio: ['ignore', 'ignore', 'ignore'],
});
const stopServer = () => { try { server.kill('SIGTERM'); } catch (_) {} };
process.on('exit', stopServer);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + 'index.html');
      if (r.ok) return;
    } catch (_) { /* まだ起きてゐない */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('配信サーバが起動しませんでした');
}
await waitForServer();

// --- 試験の道具 -------------------------------------------------------------
const results = [];
let failed = 0;
let stepNo = 0;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '  ○' : '  ×'} ${name}${detail ? '  … ' + detail : ''}`);
}

const browser = await chromium.launch({ executablePath: CHROME });

// 外部フォントの取得失敗は、この箱庭に外へ出る経路が無いためであつて
// サイトの誤りではない。会場の通信が死んでも同じことが起きるが、
// その場合も端末側の代替書体で読める（font-display:swap）。
// よつて自サイト由来の誤りだけを数へる。
function watch(page, bag) {
  page.on('pageerror', (e) => bag.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/fonts\.(googleapis|gstatic)\.com/.test(t)) return;
    if (/ERR_CONNECTION_RESET|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED/.test(t)) return;
    bag.push('console: ' + t);
  });
}

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const bag = [];
  watch(page, bag);
  return { ctx, page, bag };
}

async function shot(page, label) {
  stepNo++;
  const file = path.join(outDir, `${String(stepNo).padStart(2, '0')}-${label}.png`);
  await page.screenshot({ path: file });
}

const sel = (id) => `[data-testid="${id}"]`;

// isVisible() は「今この瞬間」を返すだけで待たない。
// この site は各画面が保存済みの状態を読んでから描くので、
// 待たずに見ると、在るはずの物を無いと誤判定する。
// 従つて必ず waitFor で待つ（無いことを確かめる場合は、
// その timeout ぶん待つてから false が返る）。
const visible = (page, id, timeout = 5000) =>
  page.locator(sel(id)).first().waitFor({ state: 'visible', timeout }).then(() => true, () => false);

// 押すと実ページ読込が起きる要素は、URL が変はり切るまで待つ。
// 固定の待ち時間で済ませると、遷移の途中を覗いて誤判定する。
async function clickAndNavigate(page, testid) {
  const before = page.url();
  await Promise.all([
    page.waitForURL((u) => String(u) !== before, { timeout: 10000 }).catch(() => {}),
    page.locator(sel(testid)).first().click(),
  ]);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

// 案内の画面（sheet）や盤面の画面（crossword）を挟むことがあるので、
// 「解答する」を押し継いで解答画面まで辿り着く。
async function reachSubmit(page) {
  for (let hop = 0; hop < 4; hop++) {
    if (/submit\.html/.test(page.url())) return true;
    const btn = page.locator(sel('solve-btn')).first();
    if (!(await btn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false))) break;
    const before = page.url();
    // 画面遷移は実ページ読み込み（nav.go）なので、URL が変はるまで待つ。
    // 固定の待ち時間だと、読み込みの遅い回に取りこぼす。
    await Promise.all([
      page.waitForURL((u) => String(u) !== before, { timeout: 10000 }).catch(() => {}),
      btn.click(),
    ]);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }
  return /submit\.html/.test(page.url());
}

// かなキーボードで一語を打ち込む。
// 画面は「行を選ぶ」→「段を選ぶ」の二段構へで、一字入れると行の画面に戻る。
// 濁点・半濁点は直前の一字を変へる働きなので、清音を入れてから押す。
const GYO = [
  ['あ', 'あいうえお'], ['か', 'かきくけこ'], ['さ', 'さしすせそ'], ['た', 'たちつてと'],
  ['な', 'なにぬねの'], ['は', 'はひふへほ'], ['ま', 'まみむめも'], ['や', 'やゆよ'],
  ['ら', 'らりるれろ'], ['わ', 'わをん'],
];
const DAKUTEN = { 'が':'か','ぎ':'き','ぐ':'く','げ':'け','ご':'こ','ざ':'さ','じ':'し','ず':'す','ぜ':'せ','ぞ':'そ',
  'だ':'た','ぢ':'ち','づ':'つ','で':'て','ど':'と','ば':'は','び':'ひ','ぶ':'ふ','べ':'へ','ぼ':'ほ' };
const HANDAKUTEN = { 'ぱ':'は','ぴ':'ひ','ぷ':'ふ','ぺ':'へ','ぽ':'ほ' };

function gyoBaseOf(ch) {
  for (const [base, dan] of GYO) if (dan.includes(ch)) return base;
  return null;
}

async function typeKana(page, word) {
  for (const ch of word) {
    let plain = ch;
    let mod = null;
    if (DAKUTEN[ch]) { plain = DAKUTEN[ch]; mod = 'dakuten'; }
    else if (HANDAKUTEN[ch]) { plain = HANDAKUTEN[ch]; mod = 'handakuten'; }

    const base = gyoBaseOf(plain);
    if (!base) throw new Error(`かな「${ch}」は五十音表に見当たりません`);

    // 行を選ぶ（既に段の画面なら一旦戻る）
    const back = page.locator(`${sel('kana-key')}[data-action="back-to-gyo"]`).first();
    if (await back.isVisible({ timeout: 200 }).catch(() => false)) await back.click();
    await page.locator(`${sel('kana-key')}[data-gyo]:text-is("${base}")`).first().click();
    // 段を選ぶ
    await page.locator(`${sel('kana-key')}[data-dan="${plain}"]`).first().click();
    // 濁点・半濁点（行の画面に戻つてゐるので、そこに在るものを押す）
    if (mod) await page.locator(`${sel('kana-key')}[data-action="${mod}"]`).first().click();
  }
}

async function readState(page) {
  return page.evaluate((pid) => {
    try { return JSON.parse(localStorage.getItem('oc2_state_' + pid)); } catch (_) { return null; }
  }, ME);
}

try {
  // ---- 1. 受付：個人QRから始める -----------------------------------------
  console.log('\n[1] 受付 — 個人QRを読んで調査を開始する');
  const main = await newPage();
  await main.page.goto(BASE + 'index.html?pid=' + ME);
  check('開始ボタンが出る', await visible(main.page, 'start-btn'));
  await shot(main.page, 'start');
  await main.page.locator(sel('start-btn')).first().click();
  await main.page.waitForURL(/folio\.html/, { timeout: 8000 }).catch(() => {});
  const storedPid = await main.page.evaluate(() => { try { return localStorage.getItem('oc2_pid'); } catch (_) { return null; } });
  check('参加者IDが保存される', storedPid === ME, storedPid || 'なし');
  check('URLから pid が消える', !main.page.url().includes('pid='), main.page.url());
  await shot(main.page, 'folio-after-start');

  // ---- 2. 印の番号の手入力（カメラが使へないときの逃げ道） ----------------
  console.log('\n[2] 逃げ道 — カメラが使へないときの印の番号');
  await main.page.goto(BASE + 'scan.html');
  check('番号入力欄が出る', await visible(main.page, 'manual-code'));
  await main.page.locator(sel('manual-code')).first().fill(String(FIRST_CODE));
  await main.page.locator(sel('manual-code-go')).first().click();
  await main.page.waitForURL(/sheet\.html/, { timeout: 8000 }).catch(() => {});
  check('案内の画面へ進む', /sheet\.html/.test(main.page.url()), main.page.url());
  await shot(main.page, 'sheet');

  // ---- 3. 誤答と正答 ------------------------------------------------------
  console.log('\n[3] 解答 — 誤答で戻され、正答で證を得る');
  check('解答画面まで辿り着く', await reachSubmit(main.page), main.page.url());
  const correct = answerOf(FIRST_Q, TEAM1);
  const wrong = ('ぬ'.repeat(correct.length) === correct) ? 'ね'.repeat(correct.length) : 'ぬ'.repeat(correct.length);
  await typeKana(main.page, wrong);
  await main.page.locator(sel('submit-btn')).first().click();
  check('誤答が知らされる', await visible(main.page, 'wrong-msg'));
  await shot(main.page, 'submit-wrong');
  await main.page.reload();
  await typeKana(main.page, correct);
  await main.page.locator(sel('submit-btn')).first().click();
  await main.page.waitForURL(/seal\.html/, { timeout: 8000 }).catch(() => {});
  check('自組の證が出る', /seal\.html\?kind=own/.test(main.page.url()), main.page.url());
  check('證書が描かれる', await visible(main.page, 'seal-cert'));
  await shot(main.page, 'seal-own');

  // ---- 4. 資料綴：相手の證はまだ伏せられてゐる ----------------------------
  console.log('\n[4] 資料綴 — 相手の證はまだ取れず、解き直しの導線も出ない');
  await main.page.goto(BASE + 'folio.html');
  check('自組の綴が見える', await visible(main.page, 'folio-tab-own'));
  await clickAndNavigate(main.page, 'folio-tab-other');
  check('相手の證は伏せられてゐる', await visible(main.page, 'folio-locked', 6000));
  check('伏せられてゐる間は證書を出さない', !(await visible(main.page, 'folio-cert', 1200)));
  await shot(main.page, 'folio-other-locked');
  await main.page.goto(BASE + 'folio.html');
  check('この時点で解き直しの導線は出ない', !(await visible(main.page, 'resolve-link', 1200)));

  // ---- 5. クロスワードと解き直し ------------------------------------------
  console.log('\n[5] 解き直し — 同じ盤面を相手の手掛かりで解く');
  await main.page.goto(BASE + 'sheet.html?q=crossword');
  check('盤面から解答画面へ辿り着く', await reachSubmit(main.page), main.page.url());
  await typeKana(main.page, answerOf('crossword', TEAM1));
  await main.page.locator(sel('submit-btn')).first().click();
  await main.page.waitForTimeout(1200);
  await main.page.goto(BASE + 'folio.html');
  check('解き直しの導線が現れる', await visible(main.page, 'resolve-link'));
  await shot(main.page, 'folio-resolve-link');
  await clickAndNavigate(main.page, 'resolve-link');
  check('解き直しは相手の手掛かりで開く', /as=other/.test(main.page.url()), main.page.url());
  check('解き直しの解答画面まで辿り着く', await reachSubmit(main.page), main.page.url());
  check('解答画面も相手側のまま', /as=other/.test(main.page.url()), main.page.url());
  await typeKana(main.page, answerOf('crossword', TEAM2));
  await main.page.locator(sel('submit-btn')).first().click();
  await main.page.waitForURL(/seal\.html/, { timeout: 8000 }).catch(() => {});
  check('相手の證が出る', /kind=other/.test(main.page.url()), main.page.url());
  await shot(main.page, 'seal-other');
  await main.page.goto(BASE + 'folio.html?tab=other');
  check('相手の證が綴に収まる', await visible(main.page, 'folio-cert'));
  check('施錠の表示は消える', !(await visible(main.page, 'folio-locked', 1200)));
  await shot(main.page, 'folio-other-unlocked');

  // ---- 6. 協力フェーズ ----------------------------------------------------
  console.log('\n[6] 協力 — 印を読み合ふ');
  await main.page.goto(BASE + 'together.html?with=' + PARTNER);
  check('自分の半分が出る', await visible(main.page, 'together-my-half'));
  const picked = rules.pickTogether(ME, PARTNER, TEAM1, TEAM2);
  const myRole = picked.role(ME);
  const shown = (await main.page.locator(sel('together-my-half')).first().innerText()).replace(/\s/g, '');
  const expectHalf = picked.question.halves[myRole].replace(/\s/g, '');
  check('表示された半分が期待どほり', shown.includes(expectHalf), `画面=${shown} / 期待=${expectHalf}`);
  await shot(main.page, 'together-linked');
  // 答への欄はかな入力の部品（<input> ではない）なので、鍵盤を叩いて入れる。
  await typeKana(main.page, picked.question.answer);
  await main.page.locator(sel('together-check')).first().click();
  await main.page.waitForTimeout(1200);
  const st = await readState(main.page);
  const expectPoints = rules.totalPoints(st);
  await shot(main.page, 'together-verified');
  await main.page.goto(BASE + 'folio.html');
  const badge = (await main.page.locator(sel('points-badge')).first().innerText()).replace(/\D/g, '');
  check('点が台帳の合計と一致する', Number(badge) === expectPoints, `画面=${badge} / 台帳=${expectPoints}`);

  // ---- 7. 同じ相手とは二度組めない ---------------------------------------
  console.log('\n[7] 重複 — 同じ二人はもう一度は組めない');
  await main.page.goto(BASE + 'together.html?with=' + PARTNER);
  check('済んだ相手だと知らせる', await visible(main.page, 'together-blocked'));
  await shot(main.page, 'together-blocked');

  // ---- 8. 相手側の端末から見ても同じ設問・逆の役 --------------------------
  console.log('\n[8] 対称 — 相手の端末でも同じ設問、役だけ入れ替はる');
  const other = await newPage();
  await other.page.goto(BASE + 'index.html?pid=' + PARTNER);
  await other.page.locator(sel('start-btn')).first().click();
  await other.page.waitForTimeout(800);
  await other.page.goto(BASE + 'together.html?with=' + ME);
  const shown2 = (await other.page.locator(sel('together-my-half')).first().innerText()).replace(/\s/g, '');
  const picked2 = rules.pickTogether(PARTNER, ME, TEAM2, TEAM1);
  check('同じ設問が選ばれる', picked2.question.id === picked.question.id, `${picked2.question.id} / ${picked.question.id}`);
  const otherRole = picked2.role(PARTNER);
  check('役が入れ替はる', otherRole !== myRole, `${otherRole} / ${myRole}`);
  check('相手の画面には別の半分が出る', shown2.includes(picked2.question.halves[otherRole].replace(/\s/g, '')), shown2);
  await shot(other.page, 'together-partner-side');
  other.bag.forEach((e) => check('相手側の画面に誤りなし', false, e));
  await other.ctx.close();

  // ---- 9. 知らないIDと、入口を飛ばした場合 --------------------------------
  console.log('\n[9] 端の場合 — 知らないID、入口を飛ばした来訪');
  const guest = await newPage();
  await guest.page.goto(BASE + 'index.html?pid=X999');
  check('知らないIDは断られる', await visible(guest.page, 'pid-error'));
  const leaked = await guest.page.evaluate(() => { try { return localStorage.getItem('oc2_pid'); } catch (_) { return null; } });
  check('知らないIDは保存されない', !leaked, leaked || 'なし');
  await shot(guest.page, 'invalid-pid');
  await guest.page.goto(BASE + 'folio.html');
  await guest.page.waitForTimeout(800);
  check('入口を飛ばすと受付へ戻される', /index\.html/.test(guest.page.url()), guest.page.url());
  await shot(guest.page, 'redirect-to-start');
  guest.bag.forEach((e) => check('来訪者側の画面に誤りなし', false, e));
  await guest.ctx.close();

  main.bag.forEach((e) => check('主たる画面に誤りなし', false, e));
  await main.ctx.close();
} catch (err) {
  check('試験が最後まで走る', false, err.message);
} finally {
  await browser.close();
  stopServer();
}

console.log('\n===== 結果 =====');
for (const r of results) console.log(`${r.ok ? '○' : '×'} ${r.name}${r.ok || !r.detail ? '' : '  … ' + r.detail}`);
console.log(`\n合格 ${results.length - failed} / ${results.length}　画像は ${outDir}`);
process.exit(failed > 0 ? 1 : 0);
