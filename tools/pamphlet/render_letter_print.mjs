// 予備用：手紙の全文を、パンフレットと同じ実寸（84.931507mm幅）で
// A4に印刷できるPDFを作る。参加者のスマホがうまく映らなかったときに、
// 紙どうしで重ね合わせられるようにするための保険。
//
//   node tools/pamphlet/render_letter_print.mjs
//
// 出力: tools/pamphlet/letter_print.pdf
//
// 仕組み
//   .letter-content の幅を基準にした正規化座標（u,v）で重ね合わせの
//   謎が組んであるので、.letter-content を screenshot して、
//   その画像を「幅 84.931507mm」としてA4ページに配置すれば、
//   3:4の縦横比はそのまま保たれ、パンフレットの印刷（62.0mm＝2つの
//   魔法陣の中心間）と物理的に一致する。84.931507mm という値は
//   tools/pamphlet/solve_overlay.py の出力（手紙の幅を%.2fmmとして印刷）
//   と同じ計算式（SPAN_MM / span）から出したもの。文面や図形を変えて
//   solve_overlay.py の数値が変わったら、このファイル冒頭の
//   LETTER_WIDTH_MM も必ず合わせて直すこと。
import { chromium } from "playwright";
import { chromeLaunchOptions } from "../chrome-path.mjs";
import { openLetter } from "./open_letter.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

// solve_overlay.py の「手紙の幅を…mmとして印刷」と同じ値。
// 実寸のよりどころなので、勝手に丸めたりしないこと。
const LETTER_WIDTH_MM = 84.931507;
const LETTER_HEIGHT_MM = LETTER_WIDTH_MM * (4 / 3); // .letter-content は常に3:4

const browser = await chromium.launch(chromeLaunchOptions());

// 印刷用なので高解像度で撮る（見た目のジャギーを防ぐ）。
const page = await browser.newPage({
  viewport: { width: 430, height: 900 },
  deviceScaleFactor: 4,
});
await openLetter(page, "file://" + path.join(ROOT, "letter.html"));

const pngPath = path.join(HERE, "letter_print_content.png");
await page.locator(".letter-content").screenshot({ path: pngPath });
await page.close();

// A4に、実寸 84.931507mm×113.242009mm で配置するだけの印刷用HTML。
const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 210mm; height: 297mm;
    font-family: sans-serif;
    position: relative;
  }
  .guide {
    position: absolute; top: 10mm; left: 0; right: 0;
    text-align: center; font-size: 9pt; color: #666;
  }
  .letterImg {
    position: absolute;
    top: 60mm; left: 50%;
    transform: translateX(-50%);
    width: ${LETTER_WIDTH_MM}mm;
    height: ${LETTER_HEIGHT_MM}mm;
    display: block;
  }
  .footer {
    position: absolute; bottom: 8mm; left: 0; right: 0;
    text-align: center; font-size: 8pt; color: #999;
  }
</style></head>
<body>
  <div class="guide">
    【予備用・実物大プリント】必ず「実際のサイズ（100%）」で印刷してください。「用紙に合わせる」は使わないこと。<br>
    参加者のスマホで手紙の魔法陣がうまく重ねられないときに、パンフレットと紙どうしで重ねる代替手段として使う。
  </div>
  <img class="letterImg" src="file://${pngPath}">
  <div class="footer">手紙の幅 ${LETTER_WIDTH_MM.toFixed(2)}mm（パンフレットと同じ実寸・中心間62.0mm校正）</div>
</body></html>`;

const htmlPath = path.join(HERE, "letter_print.html");
writeFileSync(htmlPath, html);

const printPage = await browser.newPage();
await printPage.goto("file://" + htmlPath, { waitUntil: "networkidle" });
const pdfPath = path.join(HERE, "letter_print.pdf");
await printPage.pdf({
  path: pdfPath,
  width: "210mm",
  height: "297mm",
  margin: { top: "0", bottom: "0", left: "0", right: "0" },
  printBackground: true,
});
await printPage.close();
await browser.close();

console.log("letter_print.pdf を書き出した:", pdfPath);
console.log("letter_print_content.png (元画像):", pngPath);
