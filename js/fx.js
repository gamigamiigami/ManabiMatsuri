// ========================================
// 魔法演出（FX）
// 正解・開封・登録などの瞬間に魔法陣と光の粒を発動させる。
// CSSのtransform/opacityのみで動かし、終了後はDOMから取り除く軽量設計。
// ========================================

const FX = {
  // 画面中央に魔法陣が展開して発動する
  circle(opts) {
    opts = opts || {};
    const overlay = document.createElement("div");
    overlay.className = "fx-overlay";
    overlay.innerHTML =
      '<div class="fx-flash"></div>' +
      '<svg class="fx-circle" viewBox="0 0 400 400" aria-hidden="true">' +
      '<g fill="none" stroke="#d4af6a">' +
      '<circle cx="200" cy="200" r="190" stroke-width="2"/>' +
      '<circle cx="200" cy="200" r="182" stroke-width="0.8" opacity="0.6"/>' +
      '<circle cx="200" cy="200" r="136" stroke-width="1.2" opacity="0.85"/>' +
      '<polygon points="200,64 82,268 318,268" stroke-width="1.4" opacity="0.75"/>' +
      '<polygon points="200,336 82,132 318,132" stroke-width="1.4" opacity="0.75"/>' +
      '<circle cx="200" cy="200" r="54" stroke-width="1.1" opacity="0.8"/>' +
      "</g>" +
      '<g fill="none" stroke="#9b7fe8" opacity="0.9">' +
      '<circle cx="200" cy="64" r="12" stroke-width="1.2"/>' +
      '<circle cx="82" cy="268" r="12" stroke-width="1.2"/>' +
      '<circle cx="318" cy="268" r="12" stroke-width="1.2"/>' +
      '<circle cx="200" cy="336" r="12" stroke-width="1.2"/>' +
      '<circle cx="82" cy="132" r="12" stroke-width="1.2"/>' +
      '<circle cx="318" cy="132" r="12" stroke-width="1.2"/>' +
      "</g>" +
      '<circle cx="200" cy="200" r="34" fill="none" stroke="rgba(212,175,106,0.6)" stroke-width="1" stroke-dasharray="4 6"/>' +
      "</svg>";
    document.body.appendChild(overlay);
    // 粒も一緒に散らす
    this.burst({ x: window.innerWidth / 2, y: window.innerHeight / 2, count: opts.count || 18 });
    setTimeout(function () { overlay.remove(); }, 1500);
  },

  // 光の粒バースト（x,y は画面座標）
  burst(opts) {
    opts = opts || {};
    const x = opts.x != null ? opts.x : window.innerWidth / 2;
    const y = opts.y != null ? opts.y : window.innerHeight / 2;
    const count = opts.count || 14;
    const colors = ["#f4d99a", "#d4af6a", "#c4b0ee", "#9b7fe8", "#7dd6ba", "#ffffff"];
    const holder = document.createElement("div");
    holder.className = "fx-burst";
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 60 + Math.random() * 90;
      const size = 4 + Math.random() * 6;
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.width = size + "px";
      s.style.height = size + "px";
      s.style.background = colors[Math.floor(Math.random() * colors.length)];
      s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      s.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      s.style.animationDelay = Math.random() * 0.12 + "s";
      holder.appendChild(s);
    }
    document.body.appendChild(holder);
    setTimeout(function () { holder.remove(); }, 1300);
  },

  // 要素の中心座標を取る（バーストの起点用）
  centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },
};
