// ========================================
// 最後の謎（大謎）の隠しギミック
//
// 封印を解く手順は secret.html に書いてあるが、仕掛けそのものは
// **ホーム（index.html）にしかない**。
//
//   ① 動かぬ月を、「鍵のかかった魔法陣」の中心へ運ぶ
//      → ホームの見出しの後ろにある魔法陣（.magic-circle）。
//        鍵穴が描かれているのはこの1つだけなので、迷いようがない。
//   ② 漂う「鍵」の文字を三度たたく
//      → ホームの背景を流れるルーン文字のうち「鍵」だけが指に応える。
//
// どちらも .scene の中の飾りだが、.scene は pointer-events:none で
// z-index も 0 のため、そのままでは触れないしカードの裏に隠れる。
// かといって .scene ごと前に出すと霧やビネットがカードを覆うので、
// 対象だけを #gimmickLayer（css/style.css）へ移し替えて使う。
//
// 一度使った月は二度と出さない。ページを開くたびにこのファイルが
// 保存済みの記録を見て、済んでいれば月を消す（全ページ共通）。
// ========================================

(function (global) {
  "use strict";

  var KEY = "fuin_team_v1";

  function loadTeam() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }

  function centreOf(el) {
    var b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }

  // 光の粒をまき散らす（月の消滅・鍵の破裂で使う）
  function sparks(layer, x, y, color, count, spread) {
    for (var i = 0; i < count; i++) {
      var s = document.createElement("i");
      var a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      var d = spread * (0.55 + Math.random() * 0.65);
      s.className = "spark";
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.background = color;
      s.style.boxShadow = "0 0 10px " + color;
      s.style.setProperty("--dx", Math.cos(a) * d + "px");
      s.style.setProperty("--dy", (Math.sin(a) * d - spread * 0.35) + "px");
      s.style.setProperty("--dur", (1.2 + Math.random() * 0.9).toFixed(2) + "s");
      layer.appendChild(s);
      (function (el) { setTimeout(function () { el.remove(); }, 2400); })(s);
    }
  }

  function ensureLayer() {
    var layer = document.getElementById("gimmickLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "gimmickLayer";
      document.body.appendChild(layer);
    }
    return layer;
  }

  // 背景の飾りとしての「鍵」（複数ある）
  function decorKeyRunes() {
    var out = [];
    var runes = document.querySelectorAll(".scene .runes span");
    for (var i = 0; i < runes.length; i++) {
      if (runes[i].textContent.trim() === "鍵") out.push(runes[i]);
    }
    return out;
  }

  var Gimmicks = {
    // ── ① 月を魔法陣の中心へ ──────────────────────────
    // target … 落とす先（ホームの .magic-circle）
    // done   … 成立したときに呼ばれる
    armMoon: function (target, done) {
      var moon = document.querySelector(".scene .moon");
      if (!moon || !target) return false;
      var layer = ensureLayer();
      var r = moon.getBoundingClientRect();
      moon.className = "moon-free";
      moon.style.left = r.left + "px";
      moon.style.top = r.top + "px";
      layer.appendChild(moon);

      // 魔法陣の大きさに合わせて「入った」と見なす距離を決める
      function reach() {
        var b = target.getBoundingClientRect();
        return Math.max(48, Math.min(b.width, b.height) * 0.22);
      }
      function distToCentre() {
        var m = centreOf(moon), c = centreOf(target);
        return Math.hypot(m.x - c.x, m.y - c.y);
      }

      var dragging = false, grabX = 0, grabY = 0;

      moon.addEventListener("pointerdown", function (e) {
        dragging = true;
        moon.classList.add("dragging");
        moon.setPointerCapture(e.pointerId);
        var b = moon.getBoundingClientRect();
        grabX = e.clientX - b.left;
        grabY = e.clientY - b.top;
        e.preventDefault();
      });

      moon.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        moon.style.left = (e.clientX - grabX) + "px";
        moon.style.top = (e.clientY - grabY) + "px";
        target.classList.toggle("mc-hot", distToCentre() < reach());
        // 画面の外へ行きそうなときは、魔法陣のほうへ自動でスクロール
        var b = target.getBoundingClientRect();
        if (b.bottom > window.innerHeight - 40) window.scrollBy(0, 8);
        else if (b.top < 80) window.scrollBy(0, -8);
        e.preventDefault();
      });

      function drop(e) {
        if (!dragging) return;
        dragging = false;
        moon.classList.remove("dragging");
        target.classList.remove("mc-hot");
        if (distToCentre() < reach()) {
          var c = centreOf(target), b = moon.getBoundingClientRect();
          moon.style.transition = "left .25s ease, top .25s ease";
          moon.style.left = (c.x - b.width / 2) + "px";
          moon.style.top = (c.y - b.height / 2) + "px";
          moon.classList.add("settled");
          if (global.FX && FX.circle) FX.circle();

          // 中心に収まったあと、月はゆっくり溶けて消える
          setTimeout(function () {
            var m = centreOf(moon);
            moon.classList.add("vanishing");
            sparks(layer, m.x, m.y, "rgba(247, 232, 196, 0.95)", 16, 95);
            target.classList.add("mc-lit");
            setTimeout(function () { moon.remove(); }, 2400);
          }, 700);

          if (done) done();
        }
        if (e && e.pointerId !== undefined && moon.hasPointerCapture(e.pointerId)) {
          moon.releasePointerCapture(e.pointerId);
        }
      }
      moon.addEventListener("pointerup", drop);
      moon.addEventListener("pointercancel", drop);
      return true;
    },

    // ── ②「鍵」を三度たたく ──────────────────────────
    // onTap … 1回ごと（回数を渡す）、done … 三度目
    armKey: function (onTap, done) {
      var layer = ensureLayer();
      // 飾りの「鍵」は引っこめて、代わりに触れる1文字だけを流す
      decorKeyRunes().forEach(function (el) { el.style.display = "none"; });

      var rune = document.createElement("span");
      rune.className = "key-rune";
      rune.textContent = "鍵";
      layer.appendChild(rune);

      var taps = 0;
      rune.addEventListener("click", function () {
        // 消えかけ・出る前のタイミングでは反応させない（見えている文字だけ）
        if (parseFloat(getComputedStyle(rune).opacity) < 0.25) return;

        taps += 1;
        rune.classList.remove("hit");
        void rune.offsetWidth;   // アニメーションを撒き直す
        rune.classList.add("hit");

        if (taps < 3) {
          if (onTap) onTap(taps);
          return;
        }
        // 三度目 ―― その場でふくらんで弾ける
        var b = rune.getBoundingClientRect();
        var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        rune.classList.add("spent");
        var burst = document.createElement("span");
        burst.className = "key-burst";
        burst.textContent = "鍵";
        burst.style.left = cx + "px";
        burst.style.top = cy + "px";
        layer.appendChild(burst);
        sparks(layer, cx, cy, "rgba(255, 236, 190, 0.95)", 20, 130);
        setTimeout(function () { burst.remove(); rune.remove(); }, 1700);
        if (global.FX && FX.circle) FX.circle();
        if (done) done();
      });
      return true;
    },

    // 使い終わった仕掛けを、飾りとしても出さないようにする
    hideUsed: function (team) {
      var g = (team || loadTeam() || {}).secretGate;
      if (!g) return;
      if (g.foundMoon) {
        var moon = document.querySelector(".scene .moon");
        if (moon) moon.remove();
      }
      if (g.foundKey) {
        decorKeyRunes().forEach(function (el) { el.remove(); });
      }
    },
  };

  // どのページでも、済んだ仕掛けは出さない
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { Gimmicks.hideUsed(); });
  } else {
    Gimmicks.hideUsed();
  }

  global.Gimmicks = Gimmicks;
})(window);
