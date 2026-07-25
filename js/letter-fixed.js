// ========================================
// Xからの手紙・レイアウト固定
//
// 手紙を「基準サイズで一度だけ組み立て、あとは全体を拡大縮小する」方式で表示する。
//
// ▼ なぜこの方式か
//   パンフレットの矢印が手紙の特定の文字を指す謎を成立させるには、
//   どの機種でも文字の並びが完全に同じでなければならない。
//
//   文字サイズを画面幅に合わせて変える方式だと、
//   サイズごとに字詰めの丸めが変わるため、
//   文字と文字の間隔がわずかにずれてしまう。
//
//   そこで、必ず REF_WIDTH（基準幅）で組み立ててから、
//   CSS の transform: scale() で全体を拡大縮小する。
//   transform は純粋な相似変換なので、
//   文字・余白・背景の図形がすべて同じ比率で拡大され、
//   位置関係は一切変わらない。
//
// ▼ ズームとの関係
//   ピンチズームは表示を拡大するだけでレイアウトを組み直さないので、
//   参加者が拡大縮小してパンフレットに大きさを合わせても並びは崩れない。
//
// ▼ 前提
//   本文の字形はWebフォント（Google Fonts）に依存する。
//   フォント読み込み後に組み直すようにしてあるが、
//   万一読み込めなかった端末では代替フォントで組まれる点だけ注意。
//
// ▼ 適用範囲（重要）
//   この処理は「入れた手紙だけ」に効く。既定では何もしない。
//   全部の手紙に効かせると、基準幅から縮める分だけ文字・枠線・影が
//   小さくなり、元の手紙のデザインが変わってしまうため。
//
//   謎で使う手紙にだけ、HTMLで次の属性を付けて有効にする。
//     <div class="letter" data-fixed="1" id="..."></div>
//
//   基準幅を変えたいときは data-ref="360" のように指定する
//   （小さいほど文字は大きく表示され、原寸に近づく）。
// ========================================

(function (global) {
  "use strict";

  // 有効にする手紙を選ぶ目印（既定では誰にも効かない）
  var SELECTOR = ".letter[data-fixed], .letter-body[data-fixed]";

  // 手紙を組み立てる基準の幅（px）。実際の表示はここから拡大縮小される。
  // 手持ちのスマホの手紙の幅（およそ280〜350px）に近いほど原寸に近くなる。
  var DEFAULT_REF_WIDTH = 360;
  var MIN_FONT_PX = 9;

  function refWidthOf(el) {
    var v = parseFloat(el.getAttribute("data-ref"));
    return v > 0 ? v : DEFAULT_REF_WIDTH;
  }

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

  // 拡大縮小の器を用意する。
  // 手紙そのものには transform を掛けない。
  // .letter には開封アニメーション（letterOpen）が付いており、
  // 同じ transform を奪い合って一瞬はみ出してしまうため、
  // 縮尺は外側の器に持たせて、手紙側のアニメーションはそのまま動かす。
  //
  //   .letter-scaler … 縮尺後の高さを確保する外枠（幅100%）
  //     .letter-scale … 基準幅で組み、transform で拡大縮小する内枠
  //       .letter     … 手紙そのもの（元のCSSのまま）
  function ensureScaler(el) {
    var inner = el.parentNode;
    if (inner && inner.classList && inner.classList.contains("letter-scale")) {
      return { outer: inner.parentNode, inner: inner };
    }
    var outer = document.createElement("div");
    outer.className = "letter-scaler";
    outer.style.position = "relative";
    outer.style.width = "100%";

    inner = document.createElement("div");
    inner.className = "letter-scale";
    inner.style.transformOrigin = "top left";

    el.parentNode.insertBefore(outer, el);
    outer.appendChild(inner);
    inner.appendChild(el);

    // 手紙自身の外側の余白は外枠に移す（縮尺の影響を受けないように）
    var cs = global.getComputedStyle(el);
    outer.style.marginTop = cs.marginTop;
    outer.style.marginBottom = cs.marginBottom;
    el.style.margin = "0";
    return { outer: outer, inner: inner };
  }

  // 手紙1通を基準幅で組み、画面幅に合わせて拡大縮小する
  function fitLetter(el) {
    var text = el.textContent || "";
    if (!text.replace(/\s/g, "")) return;

    var box = ensureScaler(el);
    var availOuter = box.outer.clientWidth;
    if (!(availOuter > 0)) return;         // 非表示のうちは組まない

    var REF_WIDTH = refWidthOf(el);

    // ---- 1. 基準幅で組み立てる（ここまでは全機種で同じ結果になる） ----
    box.inner.style.transform = "none";
    box.inner.style.width = REF_WIDTH + "px";
    el.style.maxWidth = "none";
    el.style.whiteSpace = "pre";
    el.style.fontSize = "";

    var cs = global.getComputedStyle(el);
    var base = parseFloat(cs.fontSize) || 16;
    var avail = REF_WIDTH - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    var nat = naturalWidth(el, text, base);
    if (nat > avail) {
      var size = base * (avail / nat);
      if (size < MIN_FONT_PX) size = MIN_FONT_PX;
      el.style.fontSize = size.toFixed(3) + "px";
    }

    // ---- 2. 全体を相似変換で画面幅に合わせる ----
    var k = availOuter / REF_WIDTH;
    box.inner.style.transform = "scale(" + k + ")";
    box.outer.style.height = (box.inner.offsetHeight * k) + "px";
    box.outer.setAttribute("data-fitted-width", String(availOuter));
  }

  // letter.html の本文は構造が違うので、折り返しを止めるだけにする
  function fitBody(el) {
    var text = el.textContent || "";
    if (!text.replace(/\s/g, "")) return;
    el.style.whiteSpace = "pre";
    el.style.fontSize = "";
    var cs = global.getComputedStyle(el);
    var base = parseFloat(cs.fontSize) || 16;
    var avail = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    if (!(avail > 0)) return;
    var nat = naturalWidth(el, text, base);
    if (nat > avail) {
      var size = base * (avail / nat);
      if (size < MIN_FONT_PX) size = MIN_FONT_PX;
      el.style.fontSize = size.toFixed(3) + "px";
    }
  }

  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }

  function fitAll() {
    each(".letter[data-fixed]", fitLetter);
    each(".letter-body[data-fixed]", fitBody);
  }

  function start() {
    if (!document.querySelector(SELECTOR)) return;   // 対象がなければ何もしない
    fitAll();

    // 本文は textContent で後から差し込まれるので、変化を見て組み直す。
    // 変えるのは style と器だけなので、監視対象（子要素・文字）は動かず無限ループしない。
    if (global.MutationObserver) {
      var t = null;
      var mo = new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(fitAll, 0);
      });
      each(SELECTOR, function (el) {
        mo.observe(el, { childList: true, characterData: true, subtree: true });
      });
    }

    // 幅が変わったとき（画面回転・カードの表示切替など）だけ組み直す。
    // 高さの変化では組み直さないので、自分の変更で再帰しない。
    if (global.ResizeObserver) {
      var ro = new ResizeObserver(function (entries) {
        entries.forEach(function (e) {
          var w = Math.round(e.target.clientWidth);
          if (String(w) === e.target.getAttribute("data-fitted-width")) return;
          var letter = e.target.querySelector(".letter");
          if (letter) fitLetter(letter);
        });
      });
      // 器は fitAll のあとに生成されるので、そのあとで監視する
      Array.prototype.forEach.call(document.querySelectorAll(".letter-scaler"), function (w) {
        ro.observe(w);
      });
    } else {
      var rt = null;
      global.addEventListener("resize", function () {
        clearTimeout(rt);
        rt = setTimeout(fitAll, 120);
      });
    }

    // フォント読み込み後は字幅が変わるので測り直す
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  }

  global.LetterFixed = { fitAll: fitAll, DEFAULT_REF_WIDTH: DEFAULT_REF_WIDTH };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);
