// ============================================================================
// crest.js — 證の紋「互ひ違ひの四弧」（採用案 7a）を SVG 文字列で描く
// ============================================================================
//
// ■ 意匠の考へ
//   輪を四つの弧に断つ。二組で弧の位置が 45 度ずれてゐるので、
//   片方だけでは輪が閉ぢない。二つを重ねて初めて八弧の輪が閉ぢ、
//   花と枝葉が揃ふ ——「二つの記録は、元は一つ」といふ筋書きそのものを紋にした物。
//     一方の組: 躑躅（つつじ）二輪 ＋ 四弧
//     他方の組: 違ひ枝と葉      ＋ 四弧（前者と互ひ違ひの位置）
//     combined: 八弧が閉ぢ、枝葉の上に花が咲く
//
// ■ 原案からの移植について（今後さわる人へ）
//   下敷きは design/crest-7a.html。あれは conic-gradient と clip-path で
//   組んだ静止画で、150×150 の箱を前提に px で座標が書いてある。
//   ここではそれを viewBox 0 0 150 150 の SVG に置き換へた。
//   数値が一致してゐるのはその為で、意味の無い魔法数ではない。
//   ・conic-gradient の弧 → 円環の扇形パス（内 65 / 外 75）
//   ・clip-path の百分率 → 箱の左上＋幅高から起こした実座標
//   角度は CSS と同じ「真上が 0 度、時計回り」で扱ふ。
//
// ■ 色は必ず config から
//   組の色をここに書いてはならない。renderCrest は CONFIG.TEAMS[key] を引く。
//   紙の色・墨の色も CONFIG.PALETTE から取る（抜きの部分に使ふので、
//   SVG の中に実際の色を書き込む必要がある）。
// ============================================================================

import { CONFIG, team as teamDef } from './config.js';

const VB = 150;      // viewBox の一辺
const C = VB / 2;    // 中心
const R_OUT = 75;    // 輪の外径
const R_IN = 65;     // 輪の内径（原案の inset:10px）

// 弧の位置。原案の conic-gradient(from 22.5deg, …) を素直に開いた物。
// 一方の組が偶数区画、他方が奇数区画を取るので 45 度ずれる。
const ARCS = {
  team1: [[22.5, 67.5], [112.5, 157.5], [202.5, 247.5], [292.5, 337.5]],
  team2: [[67.5, 112.5], [157.5, 202.5], [247.5, 292.5], [337.5, 382.5]],
};

const n = (v) => Math.round(v * 100) / 100;

/** 真上を 0 度とする時計回りの角度から、SVG の座標へ。 */
function pt(deg, r) {
  const a = (deg * Math.PI) / 180;
  return [n(C + r * Math.sin(a)), n(C - r * Math.cos(a))];
}

/** 円環の扇形（弧の帯）一つ分のパス。 */
function arcBand(from, to) {
  const [ox1, oy1] = pt(from, R_OUT);
  const [ox2, oy2] = pt(to, R_OUT);
  const [ix2, iy2] = pt(to, R_IN);
  const [ix1, iy1] = pt(from, R_IN);
  const large = (to - from) % 360 > 180 ? 1 : 0;
  return `M${ox1} ${oy1}A${R_OUT} ${R_OUT} 0 ${large} 1 ${ox2} ${oy2}` +
         `L${ix2} ${iy2}A${R_IN} ${R_IN} 0 ${large} 0 ${ix1} ${iy1}Z`;
}

// --- 躑躅の花びら -----------------------------------------------------------
// 原案の clip-path polygon(50% 10%, 66% 0, …) を、
// 幅 30・高さ 31 の箱（下辺中央が花の中心）で実座標に直した物。
const PETAL =
  'M0 -27.9L4.8 -31L9 -26.66L12.6 -16.12L7.8 -5.58L0 0L-7.8 -5.58L-12.6 -16.12L-9 -26.66L-4.8 -31Z';

// 二輪の位置と、五弁それぞれの向き。原案の left/top と rotate をそのまま。
const FLOWERS = [
  { cx: 62, cy: 56, angles: [0, 72, 144, 216, 288] },
  { cx: 88, cy: 96, angles: [36, 108, 180, 252, 324] },
];
const FLOWER_EYE = 7.5; // 花心の抜き（原案の 15px 円）

// --- 違ひ枝と葉 -------------------------------------------------------------
// 枝は幅 8・長さ 120 の丸角、中心で ±30 度に交叉する。
const BRANCH = { x: C - 4, y: C - 60, w: 8, h: 120, rx: 4 };

// 葉は四枚。原案の clip-path を実座標に起こした六角形。
const LEAVES = [
  '70 46.72 52.64 31.52 26.6 32.28 8 45.2 21.64 63.44 48.92 66.48',
  '80 46.72 97.36 31.52 123.4 32.28 142 45.2 128.36 63.44 101.08 66.48',
  '76 107.28 58.64 122.48 32.6 121.72 14 108.8 27.64 90.56 54.92 87.52',
  '74 107.28 91.36 122.48 117.4 121.72 136 108.8 122.36 90.56 94.92 87.52',
];
// 葉脈は葉を紙の色で薄く裂いた線（原案の 44×2 の細棒）。
const VEINS = [
  { x: 20, y: 44, deg: -16, cx: 42, cy: 45 },
  { x: 86, y: 44, deg: 16, cx: 108, cy: 45 },
  { x: 26, y: 106, deg: 16, cx: 48, cy: 107 },
  { x: 80, y: 106, deg: -16, cx: 102, cy: 107 },
];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

function arcsFor(key, fill) {
  return (ARCS[key] || []).map(([a, b]) => `<path d="${arcBand(a, b)}" fill="${fill}"/>`).join('');
}

function flowersFor(fill, eyeFill) {
  let out = '';
  for (const f of FLOWERS) {
    for (const a of f.angles) {
      out += `<path d="${PETAL}" fill="${fill}" transform="translate(${f.cx} ${f.cy}) rotate(${a})"/>`;
    }
    out += `<circle cx="${f.cx}" cy="${f.cy}" r="${FLOWER_EYE}" fill="${eyeFill}"/>`;
  }
  return out;
}

function branchesFor(fill, veinFill) {
  const bar = (deg) =>
    `<rect x="${BRANCH.x}" y="${BRANCH.y}" width="${BRANCH.w}" height="${BRANCH.h}" rx="${BRANCH.rx}"` +
    ` fill="${fill}" transform="rotate(${deg} ${C} ${C})"/>`;
  let out = bar(30) + bar(-30);
  for (const p of LEAVES) out += `<polygon points="${p}" fill="${fill}"/>`;
  for (const v of VEINS) {
    out += `<rect x="${v.x}" y="${v.y}" width="44" height="2" fill="${veinFill}"` +
           ` transform="rotate(${v.deg} ${v.cx} ${v.cy})"/>`;
  }
  return out;
}

/**
 * 紋を SVG 文字列で返す。
 *
 * @param {object}  o
 * @param {string}  o.team     'team1' | 'team2'（CONFIG.TEAMS の鍵）
 * @param {string}  o.variant  'own'（既定・その組だけ）| 'combined'（重ね紋）
 * @param {number}  o.size     一辺の px（既定 150）。タブの小紋なら 18〜24 で足りる
 * @param {boolean} o.locked   まだ得てゐない證。灰で薄く描く
 * @param {string}  o.paper    抜きに使ふ紙の色（既定 CONFIG.PALETTE.paper）
 * @param {string}  o.className 付けたい class（任意）
 * @returns {string} <svg>…</svg>
 *
 * 文字列を返すのは、呼び側が innerHTML で好きな所へ差し込めるやうにする為。
 * id を一つも使つてゐないので、同じ紋を一画面に何個置いても衝突しない
 * （mask や gradient を使ふと id の重複で二個目以降が崩れる）。
 */
export function renderCrest({ team, variant = 'own', size = 150, locked = false, paper, className } = {}) {
  const P = CONFIG.PALETTE || {};
  const paperColor = paper || P.paper || '#dccaa4';
  const inkColor = P.ink || '#3c2a17';
  const grey = P.locked || '#8b8272';

  const combined = variant === 'combined';
  const t1 = teamDef('team1');
  const t2 = teamDef('team2');
  const self = teamDef(team);

  // 灰の證では、二組の色をどちらも同じ灰に潰す。
  // 「まだ無い物」だと一目で分かる事の方が、色の情報より大事。
  const c1 = locked ? grey : (t1 ? t1.color : grey);
  const c2 = locked ? grey : (t2 ? t2.color : grey);
  const mine = locked ? grey : (self ? self.color : grey);

  let body = '';
  if (combined) {
    // 八弧が閉ぢる。枝葉が下、花が上。花心は墨で締める（原案どほり）。
    body += arcsFor('team1', c1) + arcsFor('team2', c2);
    body += branchesFor(c2, paperColor);
    body += flowersFor(c1, locked ? paperColor : inkColor);
  } else if (team === 'team2') {
    body += arcsFor('team2', mine);
    body += branchesFor(mine, paperColor);
  } else {
    body += arcsFor('team1', mine);
    body += flowersFor(mine, paperColor);
  }

  const label = combined
    ? (t1 && t2 ? `${t1.name}・${t2.name}` : '')
    : (self ? self.name : '');
  const cls = className ? ` class="${esc(className)}"` : '';
  const dim = locked ? ' opacity="0.45"' : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}"` +
    ` width="${size}" height="${size}"${cls} role="img" aria-label="${esc(label)}"${dim}>` +
    body +
    '</svg>'
  );
}
