// ========================================================================
// 應中秘寶調査録 v2 — kana-input.js
// 「かな4枠＋行→段キーボード」の入力部品。
//
// ■ 設計のわけ
// 参加者は子供・保護者を含むので、フルのローマ字/かなIMEを前提にせず、
// 画面内に行（あ か さ た な / は ま や ら わ）だけを先に見せ、
// タップした行の段（あ い う え お …）へ一段だけ潜って選ばせる。
// 濁点/半濁点/小書きは「直前に置いた文字を変換する」独立ボタンにして、
// 行段の組み合わせ数を増やさないようにした（濁音行を別に持たない）。
// ========================================================================

const GYO = [
  { base: "あ", dan: ["あ", "い", "う", "え", "お"] },
  { base: "か", dan: ["か", "き", "く", "け", "こ"] },
  { base: "さ", dan: ["さ", "し", "す", "せ", "そ"] },
  { base: "た", dan: ["た", "ち", "つ", "て", "と"] },
  { base: "な", dan: ["な", "に", "ぬ", "ね", "の"] },
  { base: "は", dan: ["は", "ひ", "ふ", "へ", "ほ"] },
  { base: "ま", dan: ["ま", "み", "む", "め", "も"] },
  { base: "や", dan: ["や", "ゆ", "よ"] },
  { base: "ら", dan: ["ら", "り", "る", "れ", "ろ"] },
  { base: "わ", dan: ["わ", "を", "ん"] },
];

const DAKUTEN = {
  か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご",
  さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ",
  た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど",
  は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ",
};
const DAKUTEN_REV = invert(DAKUTEN);

const HANDAKUTEN = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
const HANDAKUTEN_REV = invert(HANDAKUTEN);

const SMALL = {
  つ: "っ", や: "ゃ", ゆ: "ゅ", よ: "ょ",
  あ: "ぁ", い: "ぃ", う: "ぅ", え: "ぇ", お: "ぉ", わ: "ゎ",
};
const SMALL_REV = invert(SMALL);

function invert(map) {
  const r = {};
  for (const k in map) r[map[k]] = k;
  return r;
}

/**
 * かな入力欄をマウントする。
 *
 * @param {HTMLElement} el - 入力欄一式を差し込む要素
 * @param {Object} opts
 * @param {number} [opts.length=4] - 答えの文字数（枠の数）
 * @param {Function} [opts.onChange] - 値が変わるたび value() を渡して呼ぶ
 * @param {Function} [opts.onSubmit] - 全ての枠が埋まった瞬間に value() を渡して呼ぶ
 * @returns {{value:Function, clear:Function, shake:Function, destroy:Function}}
 */
export function mountKanaInput(el, { length = 4, onChange, onSubmit } = {}) {
  const chars = new Array(length).fill("");
  let cursor = 0;
  let level = "gyo"; // 'gyo' | 'dan'
  let activeGyo = -1;

  const root = document.createElement("div");
  root.className = "kana-input";
  const boxesEl = document.createElement("div");
  boxesEl.className = "kana-boxes";
  boxesEl.style.setProperty("--kana-len", String(length));
  const keyboardEl = document.createElement("div");
  keyboardEl.className = "kana-keyboard";
  root.appendChild(boxesEl);
  root.appendChild(keyboardEl);
  el.innerHTML = "";
  el.appendChild(root);

  function renderBoxes() {
    boxesEl.innerHTML = "";
    for (let i = 0; i < length; i++) {
      const box = document.createElement("div");
      box.className = "kana-box" + (chars[i] ? " filled" : "") + (i === cursor ? " current" : "");
      box.setAttribute("data-testid", "kana-box");
      box.textContent = chars[i];
      boxesEl.appendChild(box);
    }
  }

  function makeKey(label, testAttrs, extraClass) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kana-key" + (extraClass ? " " + extraClass : "");
    b.setAttribute("data-testid", "kana-key");
    for (const k in testAttrs) b.setAttribute(k, testAttrs[k]);
    b.textContent = label;
    return b;
  }

  function renderKeyboard() {
    keyboardEl.innerHTML = "";
    if (level === "gyo") {
      GYO.forEach((g, idx) => {
        const b = makeKey(g.base, { "data-gyo": String(idx) });
        b.addEventListener("click", () => {
          activeGyo = idx;
          level = "dan";
          renderKeyboard();
        });
        keyboardEl.appendChild(b);
      });
      const back = makeKey("⌫ 一字消す", {}, "kana-key-wide");
      back.addEventListener("click", doBackspace);
      keyboardEl.appendChild(back);
    } else {
      const g = GYO[activeGyo];
      // 5列グリッドを保つため、段が5未満の行は空セルで埋める
      for (let i = 0; i < 5; i++) {
        if (i < g.dan.length) {
          const ch = g.dan[i];
          const b = makeKey(ch, { "data-dan": ch });
          b.addEventListener("click", () => doInsert(ch));
          keyboardEl.appendChild(b);
        } else {
          const spacer = document.createElement("div");
          keyboardEl.appendChild(spacer);
        }
      }
      const toGyo = makeKey("戻る", { "data-action": "back-to-gyo" }, "kana-key-mod");
      toGyo.addEventListener("click", () => {
        level = "gyo";
        activeGyo = -1;
        renderKeyboard();
      });
      const daku = makeKey("゛", { "data-action": "dakuten" }, "kana-key-mod");
      daku.addEventListener("click", () => doMod(DAKUTEN, DAKUTEN_REV));
      const handaku = makeKey("゜", { "data-action": "handakuten" }, "kana-key-mod");
      handaku.addEventListener("click", () => doMod(HANDAKUTEN, HANDAKUTEN_REV));
      const small = makeKey("小", { "data-action": "small" }, "kana-key-mod");
      small.addEventListener("click", () => doMod(SMALL, SMALL_REV));
      const back = makeKey("⌫", { "data-action": "backspace" }, "kana-key-mod");
      back.addEventListener("click", doBackspace);
      [toGyo, daku, handaku, small, back].forEach((b) => keyboardEl.appendChild(b));
    }
  }

  function fireChange() {
    if (onChange) onChange(value());
  }

  function doInsert(ch) {
    if (cursor >= length) return;
    chars[cursor] = ch;
    cursor++;
    level = "gyo";
    activeGyo = -1;
    renderBoxes();
    renderKeyboard();
    fireChange();
    if (cursor === length && onSubmit) onSubmit(value());
  }

  function doMod(mapFwd, mapBack) {
    if (cursor === 0) return;
    const i = cursor - 1;
    const cur = chars[i];
    if (mapFwd[cur]) {
      chars[i] = mapFwd[cur];
    } else if (mapBack[cur]) {
      chars[i] = mapBack[cur];
    } else {
      return; // 変換できない文字は無視
    }
    renderBoxes();
    fireChange();
  }

  function doBackspace() {
    if (cursor === 0) return;
    cursor--;
    chars[cursor] = "";
    level = "gyo";
    activeGyo = -1;
    renderBoxes();
    renderKeyboard();
    fireChange();
  }

  renderBoxes();
  renderKeyboard();

  return {
    value() {
      return chars.join("");
    },
    clear() {
      for (let i = 0; i < length; i++) chars[i] = "";
      cursor = 0;
      level = "gyo";
      activeGyo = -1;
      renderBoxes();
      renderKeyboard();
      fireChange();
    },
    shake() {
      boxesEl.classList.remove("shake");
      // 再トリガーのため一度リフローを挟む
      void boxesEl.offsetWidth;
      boxesEl.classList.add("shake");
      setTimeout(() => boxesEl.classList.remove("shake"), 550);
    },
    destroy() {
      el.innerHTML = "";
    },
  };
}
