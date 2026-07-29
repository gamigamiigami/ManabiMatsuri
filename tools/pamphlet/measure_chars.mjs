// 手紙の全文字の位置を測って letter_chars.json と同じ形で書き出す。
// リポジトリのルートで:
//
//   node tools/pamphlet/measure_chars.mjs            … 今の値と比べるだけ
//   node tools/pamphlet/measure_chars.mjs --write    … letter_chars.json を更新
//
// 座標は .letter-content の枠を基準にした正規化座標（u = x/幅, v = y/幅）。
// 画面幅 360/390/412/430px の平均をとる。
//
// ※ 手紙は「開いた状態」で測ること。封筒を閉じたままだと行間が違い、
//    0.015 ほどずれる（このスクリプトは開いてから測っている）。
// ※ Range で測るので、本文に <span>（目印の色づけ）が入っていても
//    そのまま測れる。色を変えても位置は動かないはずで、それを
//    この比較で確かめられる。
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const WIDTHS = [360, 390, 412, 430];

const measureInPage = () => {
  const content = document.querySelector(".letter-content");
  const box = content.getBoundingClientRect();
  const body = document.getElementById("letterBody");
  const out = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const t = node.nodeValue;
    for (let i = 0; i < t.length; i++) {
      const ch = t.charAt(i);
      if (ch === "\n" || ch === " " || ch === "　") continue;
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + 1);
      const b = r.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      out.push({
        ch,
        u: (b.left + b.width / 2 - box.left) / box.width,
        v: (b.top + b.height / 2 - box.top) / box.width,
        w: b.width / box.width,
        h: b.height / box.width,
      });
    }
  }
  return out;
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const runs = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.goto("file://" + path.join(ROOT, "letter.html"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.locator(".letter-stage").click({ position: { x: width / 2, y: 400 } });
  await page.waitForTimeout(2600);   // 封筒が開いて行間が決まりきるのを待つ
  runs.push(await page.evaluate(measureInPage));
  await page.close();
}
await browser.close();

const n = runs[0].length;
if (!runs.every((r) => r.length === n)) {
  throw new Error("画面幅によって文字数が違う: " + runs.map((r) => r.length).join(", "));
}
const avg = [];
let spread = 0;
for (let i = 0; i < n; i++) {
  const o = { ch: runs[0][i].ch };
  for (const k of ["u", "v", "w", "h"]) {
    const vals = runs.map((r) => r[i][k]);
    o[k] = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(5));
    spread = Math.max(spread, Math.max(...vals) - Math.min(...vals));
  }
  avg.push(o);
}
console.log("文字数:", n, "／ 端末間のズレ 最大:", spread.toFixed(5));

const file = path.join(HERE, "letter_chars.json");
const old = JSON.parse(readFileSync(file, "utf8"));
if (old.length !== n) {
  console.log("!! 文字数が変わっている（今の json は " + old.length + " 文字）");
} else {
  let worst = 0, worstCh = "";
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(avg[i].u - old[i].u, avg[i].v - old[i].v);
    if (d > worst) { worst = d; worstCh = old[i].ch + "(" + i + ")"; }
  }
  console.log("今の letter_chars.json との差 最大:", worst.toFixed(5), worstCh,
    worst < 0.001 ? "→ 実質ゼロ（座標は動いていない）" : "→ 要確認");
}

if (process.argv.includes("--write")) {
  writeFileSync(file, JSON.stringify(avg));
  console.log("letter_chars.json を書き出した");
}
process.exit(0);
