// 重ね合わせ用モチーフ「tome（本）」を透過PNGに焼く。
//
//   node tools/motifs/render_tome.mjs
//
// 出力: images/motifs/tome.png（手紙と同じ薄さ）
//       images/motifs/tome-bold.png（パンフレット印刷用・線を濃く太く）
//
// パンフレットは PNG、手紙は同じ SVG を CSS の背景として描く。
// 両者の幾何が完全に一致していないと図形が重ならないので、
// PNG は必ず js/letter-decor.js の MOTIFS.tome から焼くこと
// （SVGをここに書き写さない）。焼き直したら solve_overlay.py の
// INK["tome"] を測り直す。
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SIZE = 2400;

// この環境の Chromium は /opt/pw-browsers/chromium に置いてある
// （playwright が期待するリビジョンとは別なので明示的に指す）。
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.addScriptTag({ content: readFileSync(path.join(ROOT, "js/letter-decor.js"), "utf8") });

const svgSrc = await page.evaluate(() => window.LetterDecor.MOTIFS.tome.svg);

// 太線版：手紙用の薄いインク色を、印刷で確実に出る濃さに置き換える。
// 色は magicCircle-bold.png（濃い茶）に合わせる。折り目をはさんで
// 並ぶ2つの図形なので、片方だけ色が違うと不自然になる。
const bold = svgSrc
  .replace(/rgba\(60,40,20,0\.26\)/g, "rgba(60,40,20,0.95)")
  .replace(/rgba\(60,40,20,0\.16\)/g, "rgba(60,40,20,0.55)")
  .replace(/stroke-width="2\.2"/g, 'stroke-width="3.6"')
  .replace(/stroke-width="1\.4"/g, 'stroke-width="2.2"');

for (const [name, src] of [["tome", svgSrc], ["tome-bold", bold]]) {
  // viewBox が正方形なので、正方形の枠にそのまま収まる（余白なしで1:1）。
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>` + src
  );
  const buf = await page.locator("svg").screenshot({ omitBackground: true });
  const out = path.join(ROOT, "images/motifs", name + ".png");
  writeFileSync(out, buf);
  console.log("書き出し:", out, buf.length, "bytes");
}

await browser.close();
process.exit(0);
