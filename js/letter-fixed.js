// ========================================
// Xからの手紙・レイアウト固定
//
// 手紙の本文を「自動折り返しなし（原文の改行のまま）」で表示し、
// 画面幅にちょうど収まる文字サイズを計算して一度だけ適用する。
//
// ▼ なぜ必要か
//   パンフレットの矢印が手紙の特定の文字を指す謎を成立させるには、
//   どの機種でも文字の並びが同じでなければならない。
//   通常の折り返しだと画面幅によって改行位置が変わってしまう。
//
// ▼ ズームとの関係
//   ピンチズームは表示を拡大するだけでレイアウトを組み直さないので、
//   参加者が拡大縮小してパンフレットに大きさを合わせても、
//   文字の並びは崩れない。
//   （ズーム時に発生する visualViewport の変化は監視しない。
//     監視しているのは画面回転などで起きる window の resize だけ。）
//
// ▼ 対象と除外
//   .letter と .letter-body に自動適用する。
//   個別に外したいときは data-nowrap="off" を付ける。
// ========================================

(function (global) {
  "use strict";

  var SELECTOR = ".letter, .letter-body";
  var MIN_FONT_PX = 9;   // これ以上小さくはしない（読めなくなるため）

  // 折り返さずに書いたときの「一番長い行」の幅を測る
  function naturalWidth(el, text, fontSizePx) {
    var cs = global.getComputedStyle(el);
    var probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;padding:0;margin:0;border:0;";
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.fontStyle = cs.fontStyle;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.fontSize = fontSizePx + "px";
    probe.textContent = text;
    document.body.appendChild(probe);
    var w = probe.getBoundingClientRect().width;
    probe.parentNode.removeChild(probe);
    return w;
  }

  function fit(el) {
    if (!el || el.getAttribute("data-nowrap") === "off") return;
    var text = el.textContent || "";
    if (!text.replace(/\s/g, "")) return;

    // 余白を比率にする。
    // px固定のままだと「本文が紙に占める割合」が画面幅で変わってしまい、
    // 図形の位置（％指定）と文字の位置がわずかにずれる。
    // ％にすると紙・余白・文字がすべて相似形になり、
    // どの機種でも矢印が同じ文字を指す。
    if (el.classList.contains("letter")) {
      el.style.padding = "7% 6.3% 9.5%";
    }

    el.style.whiteSpace = "pre";
    el.style.fontSize = "";                    // いったんCSSの既定値に戻して測る

    var cs = global.getComputedStyle(el);
    var base = parseFloat(cs.fontSize) || 16;
    var avail = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    if (!(avail > 0)) return;

    var nat = naturalWidth(el, text, base);
    if (!(nat > 0)) return;

    var size = base * (avail / nat);
    if (size > base) size = base;              // 元のデザインより大きくはしない
    if (size < MIN_FONT_PX) size = MIN_FONT_PX;
    el.style.fontSize = size.toFixed(2) + "px";
  }

  function fitAll() {
    var els = document.querySelectorAll(SELECTOR);
    Array.prototype.forEach.call(els, fit);
  }

  // 本文は textContent で後から差し込まれるので、変化を見て組み直す。
  // 変更するのは style だけ（属性は監視していない）ので無限ループにならない。
  function observe() {
    if (!global.MutationObserver) return;
    var timer = null;
    var mo = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(fitAll, 0);
    });
    Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (el) {
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function start() {
    fitAll();
    observe();
    // フォント読み込み後にずれるので測り直す
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
    // 画面回転などのときだけ組み直す（ピンチズームでは発火しない）
    var rt = null;
    global.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(fitAll, 120);
    });
  }

  global.LetterFixed = { fit: fit, fitAll: fitAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);
