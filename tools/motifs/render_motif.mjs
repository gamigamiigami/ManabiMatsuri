// 重ね合わせ用モチーフを透過PNGに焼く。
//
//   node tools/motifs/render_motif.mjs magicCircle magicCircle2
//   node tools/motifs/render_motif.mjs            … 重ね合わせ用の2つを焼く
//
// 出力: images/motifs/<名前>.png       （手紙と同じ薄さ）
//       images/motifs/<名前>-bold.png  （パンフレット印刷用・線を濃く太く）
//
// パンフレットは PNG、手紙は同じ SVG を CSS の背景として描く。
// 両者の幾何が完全に一致していないと図形が重ならないので、
// PNG は必ず js/letter-decor.js の MOTIFS から焼くこと
// （SVGをここに書き写さない）。焼き直したら
// tools/pamphlet/measure_ink.mjs で INK / INK_PNG を測り直す。
import { chromium } from "playwright";
import { chromeLaunchOptions } from "../chrome-path.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SIZE = 2400;
const NAMES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["magicCircle", "magicCircle2"];

const browser = await chromium.launch(chromeLaunchOptions());
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.addScriptTag({ content: readFileSync(path.join(ROOT, "js/letter-decor.js"), "utf8") });

for (const name of NAMES) {
  const svgSrc = await page.evaluate((n) => {
    const m = window.LetterDecor.MOTIFS[n];
    if (!m) throw new Error("そんなモチーフはない: " + n);
    return m.svg;
  }, name);

  // 太線版：手紙用の薄いインク色を、印刷で確実に出る濃さに置き換える。
  // 折り目をはさんで並ぶ2つの図形なので、片方だけ色や太さが違うと不自然。
  const bold = svgSrc
    .replace(/rgba\(60,40,20,0\.26\)/g, "rgba(60,40,20,0.95)")
    .replace(/rgba\(60,40,20,0\.16\)/g, "rgba(60,40,20,0.55)")
    .replace(/stroke-width="2\.2"/g, 'stroke-width="3.6"')
    .replace(/stroke-width="1\.4"/g, 'stroke-width="2.2"')
    // magicCircle の外周は stroke-width="1"。viewBox 200 のうち 1 は、
    // 刷ると 0.09mm しかなく、家庭用プリンタではかすれて消えかねない。
    // 五芒星（2.2→3.6）と同じ太さにそろえて 0.3mm 前後にする。
    .replace(/stroke-width="1"/g, 'stroke-width="3.6"');
  // ※ 太さを変えるとインクの外周が広がる。焼き直したら必ず
  //   python3 tools/pamphlet/measure_ink.py で INK_PNG を測り直すこと。

  for (const [out, src] of [[name, svgSrc], [name + "-bold", bold]]) {
    // viewBox が正方形なので、正方形の枠にそのまま収まる（余白なしで1:1）。
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>` + src
    );
    const buf = await page.locator("svg").screenshot({ omitBackground: true });
    const file = path.join(ROOT, "images/motifs", out + ".png");
    writeFileSync(file, buf);
    console.log("書き出し:", file, buf.length, "bytes");
  }
}

await browser.close();
process.exit(0);
