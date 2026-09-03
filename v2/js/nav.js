// ============================================================================
// nav.js — 画面の移り方（iOS Safari の拡大率対策を含む）
// ============================================================================
//
// ■ 分かったこと（第一回の js/zoom-fix.js からの持ち越し。今後さわる人へ）
//   iOS Safari は 10 以降、アクセシビリティのために viewport の
//   user-scalable=no / maximum-scale を「意図的に無視」する。
//   そのため「meta タグを一瞬だけ差し替へて拡大率を 1.0 に戻す」といふ
//   定番の小細工は iPhone では効かない。
//   （第一回でタイミングを変へて何度も試したが、実機では一度も直らなかつた。
//     それどころか、拡大した状態で meta を何度も差し替へると再レイアウトが
//     重なつて操作不能になる＝固まる事があつた。）
//   JavaScript から拡大率を戻す API は存在しない。
//   確実に等倍へ戻る唯一の道は「新しいページを実際に読み込む事」である。
//
//   さらに厄介な事に、iOS Safari は **URL ごとに拡大率を覚えてゐる**
//   （スクロール位置と同じ扱ひ）。だから固定 URL へ遷移すると、
//   二度目からは前回の拡大率が復元されてしまふ。
//   実機検証で「毎回ちがふ URL に遷移したときだけ等倍に戻る」事を確かめたので、
//   使ひ捨てのパラメータ z= を足して、常に初訪問の URL として読み込ませる。
//
//   だからこの催しでは **画面の差し替へ（SPA 的な書き換へ）を一切やらない**。
//   タブの切替へすら ?tab= を付けた実遷移にする。遅く見えるが、
//   拡大したまま操作不能になるより遥かに良い、といふのが第一回の結論である。
// ============================================================================

/** 使ひ捨てパラメータを足して遷移する。画面を変へるときは必ずこれを通す。 */
export function go(url) {
  const sep = String(url).indexOf('?') === -1 ? '?' : '&';
  location.href = url + sep + 'z=' + Date.now().toString(36);
}

/**
 * ページ名とクエリから URL を組む。
 * 値が null / undefined / '' の項目は落とす（空の ?q= が残ると
 * 「?q はあるが中身が無い」といふ扱ひづらい状態になるため）。
 */
export function href(page, params) {
  const qs = [];
  for (const [k, v] of Object.entries(params || {})) {
    if (v === null || v === undefined || v === '') continue;
    qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  }
  return qs.length ? page + '?' + qs.join('&') : page;
}

/** 現在の URL のクエリを素の object で返す。 */
export function params() {
  const out = {};
  try {
    const sp = new URLSearchParams(location.search);
    for (const [k, v] of sp.entries()) out[k] = v;
  } catch (_) { /* 何もしない */ }
  return out;
}

/**
 * 参加者 ID を持たずにこのページへ来た人を入口へ返す。
 * 返り値が null なら、呼び側は **その先の描画を全て止める**事。
 *
 * ■ なぜ黙って既定に落とさないのか
 *   第一回で「入口を通らずに直接ページを開いた人が、
 *   気付かぬまま既定のチームとして進んでしまふ」事故が起きた。
 *   本人は最後まで気付かず、記録も残らない。
 *   今回は二組対抗なので、これが起きると勝敗そのものが壊れる。
 *   よって「分からないときは進ませない」を徹底する。
 */
export function requirePid() {
  // 循環 import を避けるため、store は使ふ瞬間に読む
  let pid = '';
  try {
    pid = localStorage.getItem('oc2_pid') || '';
  } catch (_) { pid = ''; }
  if (pid) return pid;
  const next = location.pathname.split('/').pop() + location.search;
  go(href('index.html', { next }));
  return null;
}

/**
 * URL から一つの項目を消す（履歴は増やさず置き換へる）。
 * 用途: index.html で ?pid= を読んで保存した後、
 * アドレスバーに ID が残つたまま共有・再読み込みされるのを防ぐ。
 * 状態の正はあくまで保存済みの物であり、URL は入口の合図でしかない。
 */
export function stripParam(name) {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has(name)) return;
    u.searchParams.delete(name);
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '') + u.hash);
  } catch (_) { /* 古い実装では諦める（実害は無い） */ }
}

// 読み込み時は必ず先頭から見せる。
// 拡大率には触らない（触つても効かず、固まる原因になる）。
if (typeof window !== 'undefined') {
  window.scrollTo(0, 0);
  // 戻る／進むで bfcache から復元されたときも先頭へ。
  window.addEventListener('pageshow', () => window.scrollTo(0, 0));
}
