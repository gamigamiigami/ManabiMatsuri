// ========================================================================
// 應中秘寶調査録 v2 — ui.js
// 各画面で使う小さな部品（ヘッダ／フッタ／トースト／通信なし印）と、
// チーム固有の見た目・文言をここに集約する。
//
// ■ 分かったこと（なぜ teamText を通すのか）
// 「甲組」「乙組」「Team Kō」のような固有名詞をページの中に直書きすると、
// 受付でチームの組替えが起きたり、来年また別の紋・呼び名で使い回すときに
// 全画面を検索置換する羽目になる（第1回はこれで苦労した）。
// なのでチームに関する文言は必ずこの teamText() か config.js の team() を
// 経由させ、それ以外の場所にチーム名を書かない（check-config-literals.mjs
// が grep で見張っている）。
// ========================================================================

import { team } from "./config.js";
import { go } from "./nav.js";

// --- 内部ユーティリティ -------------------------------------------------

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

// 紋の完全な意匠は crest.js（Track A）に任せる。ヘッダ用の小さな丸印は
// ui.js が単独で描ける簡易版（conic-gradient の弧）にとどめ、
// crest.js への依存を増やさない。
function crestDotHtml(teamKey) {
  const t = team(teamKey);
  if (!t) return "";
  const c = t.color;
  return (
    '<span class="crest-dot" aria-hidden="true" style="display:inline-block;border-radius:50%;' +
    "background:conic-gradient(from 22.5deg," +
    c +
    " 0 45deg, transparent 45deg 90deg," +
    c +
    " 90deg 135deg, transparent 135deg 180deg," +
    c +
    " 180deg 225deg, transparent 225deg 270deg," +
    c +
    ' 270deg 315deg, transparent 315deg 360deg)"></span>'
  );
}

// --- teamText -------------------------------------------------------------

/**
 * チームに関する文言テンプレートを組み立てる。
 * {name} {short} {romaji} {roomName} {colorName} を config.js の
 * team(teamKey) の値で置き換える。teamKey が不明な場合はテンプレートを
 * そのまま返す（呼び出し側で気づけるよう、静かに握りつぶさない）。
 *
 * @param {string} teamKey
 * @param {string} tpl
 * @returns {string}
 */
export function teamText(teamKey, tpl) {
  const t = team(teamKey);
  if (!t) return tpl;
  return String(tpl)
    .replace(/\{name\}/g, t.name)
    .replace(/\{short\}/g, t.short)
    .replace(/\{romaji\}/g, t.romaji)
    .replace(/\{roomName\}/g, t.roomName)
    .replace(/\{colorName\}/g, t.colorName);
}

// --- applyTeamTheme ---------------------------------------------------

/**
 * CONFIG.TEAMS[teamKey] の色を CSS カスタムプロパティ
 * （--team / --team-ink / --team-bright / --team-name）へ反映する。
 * style.css / components.css はこれらの変数越しにチーム色を参照している。
 *
 * @param {string} teamKey
 */
export function applyTeamTheme(teamKey) {
  const t = team(teamKey);
  if (!t) return;
  const root = document.documentElement.style;
  root.setProperty("--team", t.color);
  root.setProperty("--team-ink", t.colorInk);
  root.setProperty("--team-bright", t.colorBright);
  root.setProperty("--team-name", `"${t.colorName}"`);
}

// --- mountHeader --------------------------------------------------------

/**
 * 画面上部の細い帯を描画する。左＝title（必要なら紋の丸印つき）、
 * 右＝subtitle（無ければ teamKey から自動生成した「Team {romaji}」）。
 *
 * @param {HTMLElement} el
 * @param {Object} opts
 * @param {string} [opts.title]
 * @param {string} [opts.subtitle]
 * @param {string} [opts.teamKey]
 */
export function mountHeader(el, { title = "", subtitle = "", teamKey } = {}) {
  if (!el) return;
  const right = subtitle || (teamKey ? teamText(teamKey, "Team {romaji}") : "");
  el.innerHTML =
    '<div class="hdr-bar">' +
    '<span class="hdr-title">' +
    (teamKey ? crestDotHtml(teamKey) : "") +
    "<span>" +
    escapeHtml(title) +
    "</span></span>" +
    '<span class="hdr-right">' +
    escapeHtml(right) +
    "</span>" +
    "</div>";
}

// --- mountFooter --------------------------------------------------------

/**
 * 画面下部の「ポイント＋次に行く一本のリンク」帯を描画する。
 * points が無ければポイント欄は空のまま（帳面の画面は上部に
 * 別途ポイント表示を持つため、フッタでは重複させない）。
 *
 * 遷移は必ず nav.go() 経由（実ページの読み込み）にする。ただの
 * <a href> だとブラウザは新規読込するが、iOS Safari の拡大率を
 * 等倍へ戻す z= の使い捨てクエリが付かないため（zoom-fix.js の教訓）。
 *
 * @param {HTMLElement} el
 * @param {Object} opts
 * @param {number|null} [opts.points]
 * @param {{label:string, href:string}} [opts.next]
 */
export function mountFooter(el, { points, next } = {}) {
  if (!el) return;
  const hasPoints = points !== undefined && points !== null;
  const left = hasPoints
    ? '<span class="points-badge" data-testid="points-badge">Points ' +
      escapeHtml(points) +
      "</span>"
    : "<span></span>";
  const right = next
    ? '<a class="ftr-next" href="' +
      escapeHtml(next.href) +
      '">' +
      escapeHtml(next.label) +
      " →</a>"
    : "<span></span>";
  el.innerHTML = '<div class="ftr-bar">' + left + right + "</div>";

  const a = el.querySelector(".ftr-next");
  if (a && next) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      go(next.href);
    });
  }
}

// --- toast ----------------------------------------------------------------

let toastEl = null;
let toastTimer = null;

/**
 * 画面下部に短いメッセージを出す（エラー・注意など、遷移を伴わないもの）。
 * @param {string} msg
 */
export function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2200);
}

// --- offlineMark ------------------------------------------------------

let offlineEl = null;

/**
 * 「通信なし」印の表示を切り替える。online=true なら隠す。
 * @param {boolean} online
 */
export function offlineMark(online) {
  if (!offlineEl) {
    offlineEl = document.createElement("div");
    offlineEl.className = "offline-mark";
    offlineEl.textContent = "通信なし";
    document.body.appendChild(offlineEl);
  }
  offlineEl.hidden = !!online;
}
