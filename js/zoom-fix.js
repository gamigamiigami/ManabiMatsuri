// ========================================
// ページ切り替え後に前の拡大率が残る問題への対策
// ========================================
// 画面が切り替わる（実際のページ遷移でも、show()によるカードの
// 出し替えでも）たびに、必ずピンチズームを解除してスクロールも
// 先頭へ戻す。例外は作らない。
//
// 拡大率を戻す方法：viewport の meta タグを一瞬「拡大禁止」の
// 内容に差し替えると、iOS Safari はその場で拡大率を1.0まで
// 強制的に戻す。すぐ元の内容（拡大可能）に戻せば、拡大操作自体は
// 引き続きできる。
// ・要素を作り直して差し替える（属性書き換えだけだと、実際の
//   ページ読み込み以外のタイミングでは iOS Safari が変更を
//   無視することがあるため）
// ・「戻す」タイミングは requestAnimationFrame を2回挟む
//   （＝最低でも1回分の描画を待ってから戻す）。setTimeoutの
//   固定時間待ちより確実に「拡大禁止が実際に適用された後」に
//   戻せる。
// ・iOS以外（Android Chrome・LINE/Instagram内蔵ブラウザ等）は
//   viewport書き換えがピンチズームを固めてしまう実害が過去に
//   あったため、何もしない（そもそも画面遷移で拡大率は戻る）。
// ・letter.html・letter-opening.html（data-keep-zoom付き）だけは
//   例外：手紙にパンフレットを重ねて解く謎のため、ユーザーが
//   合わせた拡大率を保つ必要がある。
(function () {
  var self = document.currentScript;
  var keepZoom = self && self.hasAttribute("data-keep-zoom");

  var ua = navigator.userAgent || "";
  var isIOS =
    /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  var meta = document.querySelector('meta[name="viewport"]');
  var original = meta ? meta.getAttribute("content") : null;

  function setViewport(content) {
    if (!meta) return;
    var next = document.createElement("meta");
    next.setAttribute("name", "viewport");
    next.setAttribute("content", content);
    meta.parentNode.replaceChild(next, meta);
    meta = next;
  }

  function resetZoom() {
    if (!isIOS || !meta || !original) return;
    setViewport(original + ", maximum-scale=1.0, user-scalable=no");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setViewport(original);
      });
    });
  }

  // 画面が切り替わるすべての箇所（実ページ遷移・show()での
  // カード出し替え）から呼ぶ共通関数。
  window.resetZoomAndScroll = function () {
    window.scrollTo(0, 0);
    if (!keepZoom) resetZoom();
  };

  if (keepZoom) return;

  // 実際のページ読み込み（新規読み込み・戻る操作でのbfcache復帰）
  // の直後にも必ず掛ける。
  document.addEventListener("DOMContentLoaded", resetZoom);
  window.addEventListener("pageshow", resetZoom);
})();
