// ============================================================================
// store.js — 参加者の識別と、状態文書の出し入れ
// ============================================================================
//
// ■ 第一回で身に沁みた事（今後さわる人へ）
//   ・localStorage は「端末に紐づく」。機種変・別ブラウザ・シークレット窓で
//     進捗は消える。だから今回は **サーバを正、端末を控へ** とした。
//   ・とはいへ会場の無線は落ちる。落ちた瞬間に遊びが止まるのは最悪なので、
//     書き込みは必ず先に端末へ同期的に置き、サーバへは投げ放しにする。
//     失敗したら控への待ち行列（pending）へ積み、次のページ読み込みで送り直す。
//   ・iOS Safari のプライベートモードでは localStorage への setItem が
//     例外を投げる（容量 0）。第一回はこれで白画面になつた事がある。
//     よつて **全ての localStorage 呼び出しを try/catch で包む**。
//     読めない・書けないときは「その回だけ諦めて動き続ける」。
//
// ■ 鍵
//   oc2_pid            … 参加者 ID。index.html の「調査を開始する」でのみ書く
//   oc2_state_<pid>    … 状態文書（rules.js の形）
//   oc2_pending_<pid>  … 送れなかった RPC の配列
//
//   ID ごとに鍵を分けてあるので、一台の端末で受付の人が
//   複数の ID を試しても互ひの進捗を潰さない。
// ============================================================================

import { CONFIG, normalizePid, team, teamOf } from './config.js';
import { emptyState, mergeState } from './rules.js';
import { api, isConfigured } from './supabase.js';

const K_PID = 'oc2_pid';
const kState = (pid) => 'oc2_state_' + pid;
const kPending = (pid) => 'oc2_pending_' + pid;
const K_LOCAL_SEQ = 'oc2_local_seq';

// --- localStorage の薄い包み（決して throw しない） -------------------------
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
}
function lsDel(key) {
  try { localStorage.removeItem(key); } catch (_) { /* 諦める */ }
}
function jsonGet(key) {
  const raw = lsGet(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

// ---------------------------------------------------------------------------
// 識別
// ---------------------------------------------------------------------------

/** 保存済みの参加者 ID。無ければ空文字。 */
export function getPid() {
  return normalizePid(lsGet(K_PID) || '');
}

/**
 * 参加者 ID を確定する。
 * **ここを呼ぶのは index.html の「調査を開始する」だけ**にする事。
 * URL に ?pid= が乗つてゐるだけで黙って確定させると、
 * 他人の QR を OS のカメラで開いた人が、その人に成り代はつてしまふ。
 */
export function setPid(pid) {
  const p = normalizePid(pid);
  if (!p) return '';
  lsSet(K_PID, p);
  return p;
}

/**
 * 組を指定して番号を自動で受け取る。
 *
 * ■ なぜ手打ちを避けるのか
 *   受付で参加者に「K017」と打たせると、打ち間違へがそのまま
 *   別人の記録になる。中学生も保護者も、慣れない端末で
 *   英字と数字の混じつた四文字を正しく打つとは限らない。
 *   教室の壁に貼つた一枚の QR（index.html?team=team1）を読めば
 *   済むやうにしておけば、そもそも打つ場面が無い。
 *
 * ■ サーバが無いとき（ローカルモード）
 *   予行演習や設定前の確認のために、その端末だけで通る番号を作る。
 *   本番の名簿と混ざらないやう、接頭辞の後を九百番台にしてある。
 *
 * @returns {Promise<{ok:boolean, pid:string, team:string, reason?:string}>}
 */
export async function claimPid(teamKey) {
  const t = team(teamKey);
  if (!t) return { ok: false, pid: '', team: '', reason: 'unknown-team' };

  if (!isConfigured()) {
    // その端末のなかだけで数へる。二台目には同じ番号が出るが、
    // ローカルモードは一台で確かめるための姿なので差し支へない。
    let n = 900;
    try {
      n = Math.max(900, parseInt(lsGet(K_LOCAL_SEQ) || '900', 10) || 900);
      lsSet(K_LOCAL_SEQ, String(n + 1));
    } catch (_) { /* 記憶できなくても進む */ }
    return { ok: true, pid: t.idPrefix + String(n).slice(-3), team: t.key, reason: 'local' };
  }

  const res = await api.claimPid(t.key);
  if (!res.ok) return { ok: false, pid: '', team: t.key, reason: 'offline' };
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  if (!row || !row.pid) {
    // 名簿の札が尽きた。誰かの札を使ひ回させると進捗が混ざるので、
    // 黙つて代用は作らず、受付へ回す。
    return { ok: false, pid: '', team: t.key, reason: 'exhausted' };
  }
  return { ok: true, pid: normalizePid(row.pid), team: row.team || t.key };
}

/** 識別だけ消す（進捗は残す。別人が同じ端末を使ふときの受付操作）。 */
export function clearPid() {
  lsDel(K_PID);
}

/** サーバ設定が空か＝ローカルモードか。画面の「通信なし」表示に使ふ。 */
export function isLocalMode() {
  return !isConfigured();
}

// ---------------------------------------------------------------------------
// 読み込み
// ---------------------------------------------------------------------------

/**
 * 状態文書を取り出す。**決して throw しない。**
 * 返り値: { state, source: 'server' | 'local' | 'new', online: boolean }
 *   server … サーバから取れた（端末の控へと併合済み）
 *   local  … サーバへ届かず、端末の控へで続行
 *   new    … どちらにも無く、この場で作った
 *
 * サーバ読みは 4 秒で打ち切る（supabase.js の既定）。
 * 4 秒の根拠: これ以上待たされると参加者は「壊れた」と思つて再読込を始め、
 * かへつて事態が悪くなる。待つより先に進める方が良い。
 */
export async function loadState() {
  const pid = getPid();
  if (!pid) return { state: null, source: 'new', online: false };

  const local = jsonGet(kState(pid));
  let online = false;
  let server = null;

  if (isConfigured()) {
    const res = await api.getState(pid);
    online = res.ok;
    if (res.ok && res.data) {
      // RPC は {state, version, team} を返す。行が無ければ state は null。
      const row = Array.isArray(res.data) ? res.data[0] : res.data;
      if (row && row.state) {
        server = row.state;
        // participants 表の組を正とする（受付での組替へに追随する）。
        if (row.team) server.team = row.team;
      } else if (row && row.team && local) {
        // 状態はまだ無いが、組だけはサーバが知つてゐる
        local.team = row.team;
      }
    }
  }

  if (server) {
    const merged = mergeState(local, server);
    saveState(merged);
    return { state: merged, source: 'server', online };
  }
  if (local) {
    return { state: local, source: 'local', online };
  }
  const fresh = emptyState(pid, teamOf(pid));
  saveState(fresh);
  return { state: fresh, source: 'new', online };
}

// ---------------------------------------------------------------------------
// 書き込み
// ---------------------------------------------------------------------------

/**
 * 状態文書を保存する。
 * 端末へは **同期的に** 書く（この行が終はつた時点で、
 * 通信がどうならうと進捗は残つてゐる）。
 * サーバへは投げ放し。失敗したら待ち行列へ積むだけで、呼び側は待たない。
 */
export function saveState(state) {
  if (!state || !state.pid) return state;
  lsSet(kState(state.pid), JSON.stringify(state));

  if (isConfigured()) {
    api.saveState(state.pid, state).then((res) => {
      if (!res.ok) enqueue(state.pid, { kind: 'state', pid: state.pid });
    }).catch(() => {
      enqueue(state.pid, { kind: 'state', pid: state.pid });
    });
  }
  return state;
}

/**
 * 参加者 ID がサーバに実在するか確かめる。
 * 返り値: { exists, team, source: 'server' | 'local' | 'offline' }
 *
 * ■ 通信できないときは「通す」
 *   受付で配つた紙の ID を持つてゐる人を、無線が落ちてゐるといふ理由で
 *   入口で止めるのは最悪の体験である（行列が動かなくなる）。
 *   形が正しければ通し、画面には「通信なし」の小さな印だけ出す。
 *   後で flushPending が届いたときに記録は揃ふ。
 *   逆に **サーバに届いた上で「無い」と言はれたとき** は、
 *   打ち間違ひが濃厚なので、はつきり誤りとして扱ふ事。
 */
export async function verifyPidOnServer(pid) {
  const p = normalizePid(pid);
  if (!p) return { exists: false, team: null, source: 'local' };
  if (!isConfigured()) {
    return { exists: true, team: teamOf(p), source: 'local' };
  }
  const res = await api.getState(p);
  if (!res.ok) return { exists: true, team: teamOf(p), source: 'offline' };
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  if (!row) return { exists: false, team: null, source: 'server' };
  return { exists: true, team: row.team || teamOf(p), source: 'server' };
}

// ---------------------------------------------------------------------------
// 送れなかった RPC の待ち行列
// ---------------------------------------------------------------------------
//
// 積むのは「何を送りたかつたか」だけで、状態文書そのものは積まない。
// 状態は常に最新の一つしか意味が無いので、
// 再送のときに改めて localStorage から読み直す方が正しい
// （古い版を後から書き戻して巻き戻る、といふ事故が起きない）。

const MAX_PENDING = 40; // 溢れたら古い物から捨てる。無限に溜めない。

function enqueue(pid, item) {
  if (!pid) return;
  const q = jsonGet(kPending(pid)) || [];
  q.push({ ...item, at: new Date().toISOString() });
  lsSet(kPending(pid), JSON.stringify(q.slice(-MAX_PENDING)));
}

/** 画面から直に積むための入口（誤答の記録などを取りこぼさないため）。 */
export function queueAttempt(entry) {
  const pid = entry && entry.pid;
  if (!pid) return;
  enqueue(pid, { kind: 'attempt', ...entry });
}

/**
 * 溜まつた分を送り直す。**待たなくてよい**（全ページの読み込み時に投げ放し）。
 * 一つでも失敗したらそこで止め、残りは次の機会に回す。
 * 順番を守るのは、link → verify の順が入れ替はると
 * サーバ側で「まだ無い組の成立」を受ける事になるため。
 */
export function flushPending() {
  const pid = getPid();
  if (!pid || !isConfigured()) return;
  const q = jsonGet(kPending(pid)) || [];
  if (!q.length) return;

  (async () => {
    const rest = q.slice();
    while (rest.length) {
      const item = rest[0];
      let res = { ok: false };
      try {
        if (item.kind === 'state') {
          const cur = jsonGet(kState(pid)); // 積んだ時の版ではなく、今の版を送る
          res = cur ? await api.saveState(pid, cur) : { ok: true };
        } else if (item.kind === 'attempt') {
          res = await api.logAttempt(item);
        } else if (item.kind === 'link') {
          res = await api.linkPair(item);
        } else if (item.kind === 'verify') {
          res = await api.verifyPair(item);
        } else {
          res = { ok: true }; // 知らない種類は捨てる
        }
      } catch (_) {
        res = { ok: false };
      }
      if (!res.ok) break;
      rest.shift();
    }
    if (rest.length !== q.length) {
      if (rest.length) lsSet(kPending(pid), JSON.stringify(rest));
      else lsDel(kPending(pid));
    }
  })();
}

/** 待ち行列の長さ（debug パネルと「通信なし」表示のため）。 */
export function pendingCount() {
  const pid = getPid();
  if (!pid) return 0;
  return (jsonGet(kPending(pid)) || []).length;
}

/** その ID の記録を全て消す（debug パネルの reset 用）。 */
export function clearAll(pid) {
  const p = normalizePid(pid || getPid());
  if (!p) return;
  lsDel(kState(p));
  lsDel(kPending(p));
  lsDel(K_PID);
}
