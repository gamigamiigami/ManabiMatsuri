// ============================================================================
// config.js — この催しの「設定」は、すべてこの一枚に集める
// ============================================================================
//
// ■ 最重要（今後さわる人へ）
//   組（チーム）の固有名詞 — 名・略称・羅馬字・色・色名・部屋の名・ID接頭辞 —
//   を書いてよいのは **このファイルだけ** である。
//   他の js / html / css に「組の名」を直接書いてはならない。
//
//   なぜか。第一回の反省として「文言が各ページに散らばり、
//   直前の変更が一箇所だけ漏れる」事故が実際に起きた。
//   今回は二組が対になる構成で、片方だけ直し忘れると
//   参加者から見て明らかに壊れて見える。
//   だから TEAMS を唯一の出所とし、画面側は必ず
//   team(key).name / .short / .color … を経由して組み立てる。
//   （検証で v2/tools/check-config-literals.mjs が
//     config.js 以外に組の名が出ていないか grep で見張る。）
//
// ■ ローカルモード
//   SUPABASE.url が空文字なら、サーバへは一切繋がず localStorage だけで動く。
//   開発中・会場の通信が死んだとき・当日の予行演習は、これで全部通る。
//   本番は supabase/README.md の手順で URL と anon key を貼る。
// ============================================================================

export const CONFIG = {
  // --- 催しそのもの ---------------------------------------------------------
  SITE: {
    title: '應中秘寶調査録',
    subtitle: '親子學び祭り 第二回',
    dateLabel: '9. i. 2027',
    // 空 = 同一オリジンの相対 URL を使う。
    // GitHub Pages のサブディレクトリ配信でも、印刷済み QR を刷り直さずに済むよう
    // 「絶対 URL を焼き込まない」ことを既定にしてある。
    // QR に絶対 URL を入れたい場合だけ 'https://example.github.io/ManabiMatsuri/v2/' の形で書く（末尾 / 必須）。
    baseUrl: '',
  },

  // --- 二つの組 -------------------------------------------------------------
  // ここが組の名の唯一の出所。key は不変（保存済みの状態文書・DB の check 制約に載る）。
  // name/short/romaji/color… は当日まで自由に差し替えてよい。
  TEAMS: {
    team1: {
      key: 'team1',
      name: '甲組',
      short: '甲',
      romaji: 'Team Kō',
      color: '#a33520',       // 基準色（紋・罫）
      colorInk: '#7c2b18',    // 濃い方（文字・縁）
      colorBright: '#c04326', // 明るい方（強調・押印）
      colorName: '朱',
      roomName: '甲組教室',
      idPrefix: 'K',          // 参加者 ID の接頭辞（K017 など）
    },
    team2: {
      key: 'team2',
      name: '乙組',
      short: '乙',
      romaji: 'Team Otsu',
      color: '#2c5088',
      colorInk: '#22406e',
      colorBright: '#3a67a8',
      colorName: '藍',
      roomName: '乙組教室',
      idPrefix: 'O',
    },
  },
  // 表示順。ID 発行や集計の並びもこれに従う。
  TEAM_ORDER: ['team1', 'team2'],

  // --- 四つの室 -------------------------------------------------------------
  // 組の教室は名前を TEAMS から引く（fromTeam）。ここに組の名を書き写さないこと。
  ROOMS: {
    team1room: { key: 'team1room', fromTeam: 'team1', label: 'Room i' },
    library:   { key: 'library',   name: '書庫',     label: 'Room ii' },
    specimen:  { key: 'specimen',  name: '標本室',   label: 'Room iii' },
    team2room: { key: 'team2room', fromTeam: 'team2', label: 'Room iv' },
  },
  ROOM_ORDER: ['team1room', 'library', 'specimen', 'team2room'],

  // --- 点数 -----------------------------------------------------------------
  // 台帳（ledger）の delta はここから決まる。合計値は保存せず常に足し直す。
  POINTS: {
    solo: 1,             // 単独の謎 一問
    soloMax: 10,         // 単独フェーズで積める上限（協力フェーズを主役にするための蓋）
    togetherSame: 5,     // 同じ組どうしで解いたとき
    togetherCross: 10,   // 異なる組どうしで解いたとき。同じ組の倍に置いてある。
                         //   単独で積める上限が 10 なので、異なる組と一度組めば
                         //   単独フェーズ丸ごとに並ぶ。「相手を探しに行く方が得だ」と
                         //   数字の側からも言つてゐる事になる。
    newPartnerBonus: 2,  // 初めて組んだ相手ごとに一度だけ
  },

  // --- 印の番号（カメラが使えないときの逃げ道） ------------------------------
  // 参加者には内部の謎 id（warmup / crossword …）を決して見せない。
  // 掲示 QR の下に三桁の番号を刷り、それを手入力してもらう。
  // 番号→謎の割り当ては当日の配置に合わせて自由に差し替えてよい。
  MANUAL_CODES: {
    201: { q: 'warmup',    room: 'team1room' },
    202: { q: 'warmup',    room: 'team2room' },
    203: { q: 'solo1',     room: 'library' },
    204: { q: 'solo2',     room: 'specimen' },
    205: { q: 'solo3',     room: 'library' },
    206: { q: 'crossword', room: 'specimen' },
    207: { q: 'solo1',     room: 'team1room' },
    208: { q: 'solo2',     room: 'team2room' },
    209: { q: 'solo3',     room: 'specimen' },
    210: { q: 'crossword', room: 'library' },
  },

  // --- サーバ ---------------------------------------------------------------
  // 空のままならローカルモード（js/supabase.js の isConfigured() が false を返す）。
  // anon key は公開鍵。RLS を有効にしポリシーを一切置かないので、
  // これが漏れても表へは触れない（RPC 経由でしか読み書きできない）。
  SUPABASE: {
    url: '',
    anonKey: '',
  },

  // ?debug=1 のときだけ隅に出る調査用パネル。当日は true のままでよい
  // （URL に ?debug=1 を付けない限り一切出ない）。
  DEBUG_ENABLED: true,

  // --- 紙と墨の色 -----------------------------------------------------------
  // 紋（crest.js）が「紙の色で抜く」ために必要な最小限。
  // 画面全体の配色は css/style.css の :root が持つ。ここはその写しではなく、
  // SVG 文字列の中に直に書き込む必要がある分だけを置いてある。
  PALETTE: {
    paper: '#dccaa4',   // 羊皮紙（紋の抜き部分）
    ink: '#3c2a17',     // 墨（重ね紋の花心）
    locked: '#8b8272',  // 未取得の證を灰にするときの色
  },
};

// ============================================================================
// 引き当ての小道具
// ============================================================================

/** 組の定義を引く。未知の key なら undefined（黙って既定に落とさない）。 */
export function team(key) {
  return CONFIG.TEAMS[key];
}

/**
 * 参加者 ID から組を推す。
 * 注意: これは「受付前の初期値」でしかない。
 * 当日の組替えに耐えるため、正はサーバの participants 表であり、
 * 状態文書の state.team はサーバの値で上書きされる（rules.mergeState 参照）。
 */
export function teamOf(pid) {
  const p = normalizePid(pid);
  if (!p) return null;
  const head = p.slice(0, 1);
  for (const key of CONFIG.TEAM_ORDER) {
    if (CONFIG.TEAMS[key].idPrefix === head) return key;
  }
  return null;
}

/** 相手の組の key。片方しか無いときは null。 */
export function otherTeam(key) {
  const i = CONFIG.TEAM_ORDER.indexOf(key);
  if (i < 0) return null;
  return CONFIG.TEAM_ORDER[(i + 1) % CONFIG.TEAM_ORDER.length] || null;
}

/** 室の名。組の教室は TEAMS から引く（名の二重管理を避けるため）。 */
export function roomName(roomKey) {
  const r = CONFIG.ROOMS[roomKey];
  if (!r) return '';
  if (r.fromTeam) {
    const t = CONFIG.TEAMS[r.fromTeam];
    return t ? t.roomName : '';
  }
  return r.name || '';
}

// 参加者 ID の形。接頭辞は TEAMS から組み立てるので、
// 接頭辞を変えれば正規表現も自動で追従する。
const PREFIXES = CONFIG.TEAM_ORDER.map((k) => CONFIG.TEAMS[k].idPrefix).join('');
export const pidPattern = new RegExp('^[' + PREFIXES + ']\\d{3}$');

/**
 * 入力された ID を整える。
 * ここを甘くしておかないと、当日「入れたのに弾かれる」で行列が止まる。
 *  - 全角英数（Ｋ０１７）→ 半角
 *  - 小文字 → 大文字
 *  - 空白・ハイフン・全角空白 → 除去
 * 形が合わなければ空文字を返す（呼び側で必ず判定すること）。
 */
export function normalizePid(s) {
  if (typeof s !== 'string') return '';
  let t = s;
  // 全角英数を半角へ（Ａ-Ｚ ａ-ｚ ０-９ は U+FF21.. の連続並び）
  t = t.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  t = t.replace(/[\s　\-‐-―－_.]/g, '');
  t = t.toUpperCase();
  return pidPattern.test(t) ? t : '';
}
