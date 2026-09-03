// ============================================================================
// rules.js — 正誤の判定と点数の算術。ここだけが「規則」を知る
// ============================================================================
//
// ■ この一枚の約束
//   1. すべて純関数。DOM も localStorage も fetch も触らない。
//      （node からそのまま import して検算できる。tools/smoke.mjs がそれを使ふ。）
//   2. 状態は書き換へず、新しい物を返す（呼び側は返り値を保存する）。
//   3. 点数は **台帳（ledger）の合計としてのみ** 導かれる。
//      合計値を状態に持たせない。第一回で「端末ごとに合計がずれ、
//      どちらが正しいか誰にも言へない」事故を見たので、
//      加算の履歴だけを持ち、合計は毎回足し直す事にした。
//   4. 台帳の各行は ref（一意の文字列）を持ち、同じ ref は二度入らない。
//      これで「二台で同時に解いた」「再送が重なつた」でも二重加算しない。
//
// ■ 状態文書の形（store.js / supabase の participant_state.state と同じ）
//   {
//     v: 1, pid, team, createdAt, updatedAt,
//     solved: { 'warmup': {at, wrong, via}, 'crossword': {...}, 'crossword:other': {...} },
//     wrong:  { 'warmup': 2 },                      // まだ正解してゐない試行回数
//     seals:  { own: ISO|null, other: ISO|null },
//     links:  { 'K017|O042': { partnerPid, partnerTeam, pool, questionId,
//                              index, role, linkedAt, verifiedAt|null, wrong } },
//     ledger: [ { ref, kind, delta, at }, ... ]
//   }
//   solved / links / ledger はすべて単調増加（消えない）。
//   だから二つの状態の併合は「和集合」で安全である（mergeState 参照）。
// ============================================================================

import { CONFIG } from './config.js';
import { PUZZLES, TOGETHER } from './puzzles.js';

// ---------------------------------------------------------------------------
// 文字の均し
// ---------------------------------------------------------------------------

/**
 * 答へ合はせの前に、入力を均す。
 * 会場で実際に起きるのは「濁点が分かれてゐる」「片仮名で入れた」
 * 「間に空白を入れた」「大文字小文字」— 正誤の本質と関係ない差ばかりなので、
 * ここで全部吸収する。逆に、拗音・促音（ゃ ゅ ょ っ）は意味を変へるので残す。
 */
export function normalizeWord(s) {
  if (typeof s !== 'string') return '';
  let t = s;
  // NFKC で全角英数・半角カナ・合成濁点をまとめて正規化する。
  try { t = t.normalize('NFKC'); } catch (_) { /* 古い実装でも落とさない */ }
  // 空白・句読点・中黒・各種ダッシュを除く
  t = t.replace(/[\s　。、，．・･,.\-‐-―ー－_/／\\|｜'"「」『』（）()]/g, '');
  // 片仮名 → 平仮名（U+30A1..U+30F6 のみ。ヴ ヵ ヶ も含めて 0x60 引く）
  t = t.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
  return t.toLowerCase();
}

// ---------------------------------------------------------------------------
// 単独フェーズの答へ合はせ
// ---------------------------------------------------------------------------

/** その組にとっての答へ。answers が文字列なら両組共通。 */
export function answerFor(puzzle, teamKey) {
  if (!puzzle) return '';
  const a = puzzle.answers;
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object') return a[teamKey] || '';
  return '';
}

/** 正解なら true。判定の入口はここ一箇所だけ。 */
export function checkAnswer(puzzle, teamKey, input) {
  const expected = normalizeWord(answerFor(puzzle, teamKey));
  if (!expected) return false;
  return normalizeWord(input) === expected;
}

// ---------------------------------------------------------------------------
// 二人一組の鍵と、出題の決め方
// ---------------------------------------------------------------------------

/**
 * 二つの ID から順序に依らぬ鍵を作る。
 * 「誰が先に読み取つたか」で鍵が変はると、同じ二人が二重に登録され、
 * 点も二重に入つてしまふ。だから必ず辞書順に並べる。
 * サーバの pair_links も pid_low < pid_high の制約で同じ形を強制する。
 */
export function pairKey(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  return x < y ? x + '|' + y : y + '|' + x;
}

/**
 * FNV-1a（32bit）。暗号用途ではない — 「二台の端末が、
 * サーバに聞かずに、必ず同じ番号を出す」ためだけの散らし。
 * 実装が短く、桁溢れの扱ひが処理系に依らないのでこれを選んだ。
 */
export function pairHash(key) {
  let h = 0x811c9dc5;
  const s = String(key || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 0xff;
    // 32bit 乗算を Math.imul で正確に。>>> 0 で符号なしに戻す。
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * 二人に出す符牒を決める。**サーバ往復なし**で両端末が同じ結果に至る。
 *   - 引く札束: 同じ組どうしなら TOGETHER.same、違ふ組なら TOGETHER.cross
 *   - 何枚目か: 並べ替へた鍵のハッシュ % 枚数
 *   - 役:       ID の辞書順で小さい方が 'A'、大きい方が 'B'
 * 返り値の role は関数。role(pid) で自分の役を引く。
 *
 * ※ 札の枚数を当日いじると、既に組んだ二人の出題がずれる。
 *   puzzles.js の頭にも書いたが、枚数は固定である。
 */
export function pickTogether(a, b, teamA, teamB) {
  const pid1 = String(a || '');
  const pid2 = String(b || '');
  const pool = teamA === teamB ? 'same' : 'cross';
  const list = TOGETHER[pool] || [];
  const key = pairKey(pid1, pid2);
  const index = list.length ? pairHash(key) % list.length : 0;
  const question = list[index] || null;
  const low = pid1 < pid2 ? pid1 : pid2;
  return {
    pool,
    index,
    question,
    key,
    role(pid) {
      return String(pid || '') === low ? 'A' : 'B';
    },
  };
}

/**
 * 相手の半分を聞き取つて打ち込んだ物が合つてゐるか。
 * A も B も **同じ answer** を打つ（半分どうしを突き合はせるのではなく、
 * 二つを合はせて初めて出る一つの答へを、二人がそれぞれ入れる）。
 * link は state.links[pairKey] の中身（pool と questionId を持つ）。
 */
export function checkTogether(link, typed) {
  if (!link) return false;
  const list = TOGETHER[link.pool] || [];
  let q = list.find((x) => x.id === link.questionId);
  // questionId が見つからぬとき（札を差し替へた後など）は index で拾ふ。
  if (!q && typeof link.index === 'number') q = list[link.index];
  if (!q) return false;
  return normalizeWord(typed) === normalizeWord(q.answer);
}

// ---------------------------------------------------------------------------
// 状態文書
// ---------------------------------------------------------------------------

const nowIso = (now) => (now ? new Date(now).toISOString() : new Date().toISOString());

/** まっさらな状態。team は必ず呼び側が渡す（黙って既定に落とさない）。 */
export function emptyState(pid, team) {
  const at = nowIso();
  return {
    v: 1,
    pid: String(pid || ''),
    team: team || null,
    createdAt: at,
    updatedAt: at,
    solved: {},
    wrong: {},
    seals: { own: null, other: null },
    links: {},
    ledger: [],
  };
}

/** 台帳の合計。これが唯一の「持ち点」の出所。 */
export function totalPoints(state) {
  const led = (state && state.ledger) || [];
  let sum = 0;
  for (const e of led) sum += Number(e && e.delta) || 0;
  return sum;
}

/** 単独フェーズで既に積んだ点（上限の判定に使ふ）。 */
function soloEarned(state) {
  let sum = 0;
  for (const e of (state.ledger || [])) {
    if (e && e.kind === 'solo') sum += Number(e.delta) || 0;
  }
  return sum;
}

/** ref が既に台帳にあるか。 */
function hasRef(state, ref) {
  return (state.ledger || []).some((e) => e && e.ref === ref);
}

/** 状態を浅く複製する（呼び側の物を壊さないため）。 */
function clone(state) {
  return {
    ...state,
    solved: { ...(state.solved || {}) },
    wrong: { ...(state.wrong || {}) },
    seals: { ...(state.seals || { own: null, other: null }) },
    links: { ...(state.links || {}) },
    ledger: (state.ledger || []).slice(),
  };
}

/**
 * 誤答を一つ数へる。
 * key は謎の鍵（'warmup' / 'crossword:other'）か、
 * 協力フェーズの二人組の鍵（'K017|O042'）。
 * 後者なら links の中の wrong も一緒に上げる（画面が回数を出すため）。
 */
export function applyWrong(state, key) {
  if (!state || !key) return state;
  const next = clone(state);
  next.wrong[key] = (Number(next.wrong[key]) || 0) + 1;
  if (next.links[key]) {
    next.links[key] = { ...next.links[key], wrong: (Number(next.links[key].wrong) || 0) + 1 };
  }
  next.updatedAt = nowIso();
  return next;
}

/**
 * 正解を記録する。
 *   puzzleId … PUZZLES の鍵
 *   asOther  … 解き直し（相手の組として解く）なら true。鍵は 'crossword:other'
 *   via      … 'qr' | 'code' | 'link' など、どこから来たかの記録
 *
 * ■ 単独フェーズの上限（POINTS.soloMax）の扱ひ
 *   上限に掛かつた場合でも **台帳には delta を減らした（あるいは 0 の）行を積む**。
 *   行そのものを落とさない理由は二つ。
 *     ・ref を残さないと、再送や別端末との併合でもう一度足されてしまふ。
 *     ・「解いたが点は付かなかつた」事実を運営が後から追へる。
 *   参加者には「解いた」事実（solved）で答へるので、点が 0 でも画面は正しく動く。
 */
export function applySolve(state, { puzzleId, asOther = false, via = null, now = null } = {}) {
  // 返り値は必ず { state, seal, delta } の形。
  // 呼び出し側（submit.html）は seal で次の画面を決め、delta を證書に出す。
  // 「新しい状態だけ返す」形にすると、どちらへ進むかを呼び出し側が
  // 謎の定義から組み立て直すことになり、判定の置き場所が二つに割れる。
  const noop = { state, seal: null, delta: 0 };
  if (!state || !puzzleId) return noop;
  const puzzle = PUZZLES[puzzleId];
  if (!puzzle) return noop;

  const key = asOther ? puzzleId + ':other' : puzzleId;
  if (state.solved && state.solved[key]) return noop; // 既に正解済み。何もしない。

  const at = nowIso(now);
  const next = clone(state);

  next.solved[key] = { at, wrong: Number(next.wrong[key]) || 0, via: via || null };

  // 台帳（上限を適用）
  let delta = 0;
  const ref = 'solve:' + key;
  if (!hasRef(next, ref)) {
    const want = Number(puzzle.points) || CONFIG.POINTS.solo;
    const room = Math.max(0, CONFIG.POINTS.soloMax - soloEarned(next));
    delta = Math.min(want, room);
    next.ledger.push({ ref, kind: 'solo', delta, at });
  }

  // 證
  const kind = asOther ? (puzzle.reSolveGrantsSeal || null) : (puzzle.grantsSeal || null);
  let seal = null;
  if (kind === 'own' || kind === 'other') {
    if (!next.seals[kind]) next.seals[kind] = at;
    seal = kind;
  }

  next.updatedAt = at;
  return { state: next, seal, delta };
}

/**
 * 相手と組む（まだ答へ合はせは済んでゐない）。
 * どの札を引くかはここで確定し、状態に焼き込む。
 * 焼き込む理由: 後から puzzles.js を差し替へても、
 * 既に組んだ二人の出題が変はらないやうにするため。
 */
export function applyLink(state, { partnerPid, partnerTeam = null, now = null } = {}) {
  // 返り値は必ず { state, link } の形（together.html が link を直接描く）。
  if (!state || !partnerPid) return { state, link: null };
  const me = state.pid;
  if (!me || partnerPid === me) return { state, link: null }; // 自分自身とは組めない
  const key = pairKey(me, partnerPid);
  const at = nowIso(now);
  const next = clone(state);

  if (next.links[key]) {
    // 既にある。相手の組だけは後から判明する事があるので補ふ
    // （組が判明すると札束が same/cross で変はるため、出題も引き直す）。
    const cur = next.links[key];
    if (partnerTeam && cur.partnerTeam !== partnerTeam && !cur.verifiedAt) {
      const picked = pickTogether(me, partnerPid, state.team, partnerTeam);
      next.links[key] = {
        ...cur,
        partnerTeam,
        pool: picked.pool,
        questionId: picked.question ? picked.question.id : null,
        index: picked.index,
        role: picked.role(me),
      };
      next.updatedAt = at;
    }
    return { state: next, link: next.links[key] };
  }

  const picked = pickTogether(me, partnerPid, state.team, partnerTeam);
  next.links[key] = {
    partnerPid,
    partnerTeam: partnerTeam || null,
    pool: picked.pool,
    questionId: picked.question ? picked.question.id : null,
    index: picked.index,
    role: picked.role(me),
    linkedAt: at,
    verifiedAt: null,
    wrong: 0,
  };
  next.updatedAt = at;
  return { state: next, link: next.links[key] };
}

/**
 * 答へ合はせが成立した。点を積む。
 *   ・札束に応じて same 3 / cross 5
 *   ・その相手と組むのが初めてなら +2（ref を 'bonus:<相手 ID>' にして一度だけ）
 * 単独フェーズの上限はここには掛けない（協力フェーズを主役にするため）。
 */
export function applyTogetherVerified(state, key, now = null) {
  // 返り値は必ず { state, delta } の形（delta は「今回積んだ点」で、成立の演出に使ふ）。
  if (!state || !key) return { state, delta: 0 };
  const link = state.links && state.links[key];
  if (!link || link.verifiedAt) return { state, delta: 0 };

  const at = nowIso(now);
  const next = clone(state);
  next.links[key] = { ...link, verifiedAt: at };

  let gained = 0;
  const ref = 'together:' + key;
  if (!hasRef(next, ref)) {
    const delta = link.pool === 'same' ? CONFIG.POINTS.togetherSame : CONFIG.POINTS.togetherCross;
    next.ledger.push({ ref, kind: 'together', delta, at });
    gained += delta;
  }

  const bonusRef = 'bonus:' + link.partnerPid;
  if (link.partnerPid && !hasRef(next, bonusRef)) {
    next.ledger.push({ ref: bonusRef, kind: 'newPartner', delta: CONFIG.POINTS.newPartnerBonus, at });
    gained += CONFIG.POINTS.newPartnerBonus;
  }

  next.updatedAt = at;
  return { state: next, delta: gained };
}

// ---------------------------------------------------------------------------
// 併合
// ---------------------------------------------------------------------------

/** 二つの ISO 日時のうち早い方（片方が無ければ在る方）。 */
function earlier(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

/**
 * 端末に残つてゐる状態（local）とサーバから来た状態（server）を合はせる。
 *
 * ■ なぜ「和集合」でよいのか
 *   solved / links / ledger / seals は一度立つたら二度と降りない（単調増加）。
 *   降りない量だけで構成してあるので、どちらが新しいかを判定せずとも
 *   両方を足し合はせれば必ず正しい最新に一致する。
 *   これが「通信が切れても進行が止まらない」設計の土台である。
 *
 * ■ 例外は team だけ
 *   受付での組替へがあり得るので、team はサーバを正とする
 *   （サーバに無ければ端末の値を残す）。
 */
export function mergeState(local, server) {
  if (!local) return server ? { ...server } : null;
  if (!server) return { ...local };

  const out = clone(local);

  out.v = 1;
  out.pid = server.pid || local.pid;
  out.team = server.team || local.team || null; // 組はサーバが正
  out.createdAt = earlier(local.createdAt, server.createdAt);

  // solved … 鍵で和集合。同じ鍵は早い方の記録を採る
  for (const [k, sv] of Object.entries(server.solved || {})) {
    const lv = out.solved[k];
    if (!lv) out.solved[k] = sv;
    else if (earlier(lv.at, sv.at) === sv.at) out.solved[k] = sv;
  }

  // wrong … 大きい方（試行回数は端末ごとに数へてゐるので、多い方が実態に近い）
  for (const [k, sv] of Object.entries(server.wrong || {})) {
    out.wrong[k] = Math.max(Number(out.wrong[k]) || 0, Number(sv) || 0);
  }

  // seals … 早い非 null
  const sseals = server.seals || {};
  out.seals = {
    own: earlier(out.seals.own, sseals.own || null),
    other: earlier(out.seals.other, sseals.other || null),
  };

  // links … 鍵で和集合。verifiedAt は早い非 null、wrong は大きい方
  for (const [k, sv] of Object.entries(server.links || {})) {
    const lv = out.links[k];
    if (!lv) { out.links[k] = sv; continue; }
    out.links[k] = {
      ...lv,
      partnerTeam: lv.partnerTeam || sv.partnerTeam || null,
      linkedAt: earlier(lv.linkedAt, sv.linkedAt),
      verifiedAt: earlier(lv.verifiedAt, sv.verifiedAt),
      wrong: Math.max(Number(lv.wrong) || 0, Number(sv.wrong) || 0),
    };
  }

  // ledger … ref で重複排除。早い方の行を残す
  const byRef = new Map();
  for (const e of out.ledger) if (e && e.ref) byRef.set(e.ref, e);
  for (const e of (server.ledger || [])) {
    if (!e || !e.ref) continue;
    const cur = byRef.get(e.ref);
    if (!cur || earlier(cur.at, e.at) === e.at) byRef.set(e.ref, e);
  }
  out.ledger = Array.from(byRef.values()).sort((x, y) =>
    String(x.at || '').localeCompare(String(y.at || ''))
  );

  out.updatedAt = nowIso();
  return out;
}

/**
 * 「解いた符を開き直す」導線を出してよいか。
 * 条件: 自分の組の證を持ち、方眼を一度解いてゐて、まだ相手の組の證を持たない。
 * 画面側（folio / submit?as=other）は表示ヒントを信じず、必ずこれで再判定する。
 */
export function canResolveAsOther(state) {
  if (!state) return false;
  const solved = state.solved || {};
  const seals = state.seals || {};
  return Boolean(seals.own) && Boolean(solved.crossword) && !seals.other && !solved['crossword:other'];
}
