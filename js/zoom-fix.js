// スマホ（主にiOS Safari）で、前のページの拡大率がページ切り替え後も
// 残ってしまう問題への対策。viewportのcontentを一瞬だけ書き換えて
// 強制的にズームをリセットする。
(function () {
  function resetZoom() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    var original = meta.getAttribute("content");
    meta.setAttribute("content", original + ", maximum-scale=1.0, user-scalable=no");
    setTimeout(function () {
      meta.setAttribute("content", original);
    }, 200);
  }
  document.addEventListener("DOMContentLoaded", resetZoom);
  window.addEventListener("pageshow", resetZoom);
})();
