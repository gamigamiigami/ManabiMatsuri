// ========================================
// ページ切り替え後に前の拡大率が残る問題への対策
// ========================================
// ただし最優先は「拡大できないまま固まらないこと」。
// 最後の謎は letter.html の手紙にパンフレットを重ねて解くので、
// 画面を指で広げて紙の大きさを合わせられないと詰んでしまう。
//
// もともとの実装は全端末で viewport に user-scalable=no を差し込み、
// 200ms後に戻していた。iOS Safari ではこれで拡大率が戻るが、
// Android Chrome や WebView（LINE・Instagram などの内蔵ブラウザ）では
// 元に戻してもピンチズームが復活しないことがあり、
// さらに pageshow（戻る操作・bfcache復帰）で何度も掛かるため、
// 一度ロックされると解除できなくなっていた。
//
// そこで、
//   ・Android系では最初から何もしない（そもそも遷移で拡大率が戻る）
//   ・iOSでも「実際に拡大されているとき」だけ、ごく短時間だけ掛ける
//   ・画面に触れた時点で即座に元へ戻す＋保険のタイマーでも戻す
//   ・data-keep-zoom を付けた読み込みでは一切動かさない（letter.html）
// という形にした。
(function () {
  var self = document.currentScript;
  var keepZoom = self && self.hasAttribute("data-keep-zoom");

  var ua = navigator.userAgent || "";
  var isIOS =
    /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  var meta = document.querySelector('meta[name="viewport"]');
  var original = meta ? meta.getAttribute("content") : null;
  var timer = null;

  // どんな経路で呼ばれても、必ず元の viewport（拡大できる状態）へ戻す
  function restore() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (meta && meta.getAttribute("content") !== original) {
      meta.setAttribute("content", original);
    }
  }

  function resetZoom() {
    if (!isIOS || !meta) return;
    // すでに等倍なら触らない。触らなければ固まりようがない。
    var vv = window.visualViewport;
    if (vv && Math.abs(vv.scale - 1) < 0.01) return;

    meta.setAttribute("content", original + ", maximum-scale=1.0, user-scalable=no");
    timer = setTimeout(restore, 200);
    // 保険①：指が触れたらその場で解除（拡大しようとする操作を邪魔しない）
    window.addEventListener("touchstart", restore, { once: true, passive: true });
    // 保険②：万一タイマーが飛んでも、必ず戻す
    setTimeout(restore, 1500);
  }

  // ▼ 画面内の「カードの出し替え」（ページ遷移なしでDOMだけ切り替える場面。
  //   例：チーム登録直後にホームを描き直す、謎を解いてクリア画面に
  //   切り替える、など）のあとに呼ぶための共通関数。
  //   ・スクロール位置を必ず先頭へ戻す（全端末共通・副作用なし）
  //   ・拡大率のリセットは iOS のみ（Android/内蔵ブラウザでは
  //     viewportの書き換えがピンチズームを固めてしまった過去の事故が
  //     あるため、確実に安全なiOSだけに絞ってある）
  //   letter.html・letter-opening.html（data-keep-zoom付き）では、
  //   パンフレット重ね謎のためにユーザーが合わせた拡大率を保ちたいので、
  //   スクロールだけ戻し、拡大率には触らない。
  window.resetZoomAndScroll = function () {
    window.scrollTo(0, 0);
    if (!keepZoom) resetZoom();
  };

  if (keepZoom) return;

  document.addEventListener("DOMContentLoaded", resetZoom);
  window.addEventListener("pageshow", resetZoom);
  document.addEventListener("visibilitychange", restore);
})();
