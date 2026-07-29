// ========================================
// 在り処謎の見せかた（point.html とホームで共通）
//
// 一部の在り処謎は、1枚の画像の下半分にヒント（五十音表など）が
// 埋め込まれている。そのままだと謎と一緒にヒントまで見えてしまうので、
//   ・ふだんは上半分（謎）だけ
//   ・ヒントボタンを押したら下半分（表）
// を切り出して見せる。切り出しは css/style.css の .arika-crop-* が行う。
//
// point.html とホームの2か所で同じ画像を出すため、ここに寄せてある。
// 片方だけ直してヒントが丸見えになる事故を防ぐのが目的。
// ========================================

(function (global) {
  "use strict";

  function cropped(src, cls, alt) {
    var wrap = document.createElement("div");
    wrap.className = "arika-crop-wrap " + cls;
    var img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.onerror = function () { wrap.remove(); };
    wrap.appendChild(img);
    return wrap;
  }

  var Arika = {
    // 在り処謎そのものを box に描く。画像が無ければ false を返す。
    showPuzzle: function (box, puzzle) {
      if (!puzzle || !puzzle.arikaImage) return false;
      box.innerHTML = "";
      if (puzzle.arikaHintIsImage) {
        // 下半分はヒントなので、上半分だけを見せる
        box.appendChild(cropped(puzzle.arikaImage, "arika-crop-top", "在り処謎"));
      } else {
        var img = document.createElement("img");
        img.src = puzzle.arikaImage;
        img.alt = "在り処謎の画像";
        img.onerror = function () { this.remove(); };
        box.appendChild(img);
      }
      return true;
    },

    // ヒントを el に描く。画像に埋め込まれている謎は下半分の表を出す。
    showHint: function (el, puzzle) {
      el.textContent = "";
      if (!puzzle.arikaHintIsImage) {
        el.textContent = puzzle.arikaHint;
        return;
      }
      el.appendChild(cropped(puzzle.arikaImage, "arika-crop-hint", "ヒントの五十音表"));
      var caption = document.createElement("p");
      caption.className = "note center";
      caption.style.marginTop = "8px";
      caption.textContent = "これが使えそうだ…。";
      el.appendChild(caption);
    },
  };

  global.Arika = Arika;
})(window);
