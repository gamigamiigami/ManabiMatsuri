// 重ね合わせの検証用スクリーンショットを撮る。
//
//   node tools/pamphlet/shoot_overlay.mjs <出力先ディレクトリ>
//
// letter.html の便箋（.letter-content）と、パンフレットA1面（#panel-a1）を
// それぞれ画像に落とす。あとは verify_overlay.py が、solve_overlay.py の
// 数値どおりに紙を傾けて重ね、図形が本当につながるか目で確かめる。
import { chromium } from "playwright";
import { chromeLaunchOptions } from "../chrome-path.mjs";
import { openLetter } from "./open_letter.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// 書き出し先。指定しないと "undefined/" というゴミが出来ていたので、
// 未指定なら実行した場所に out/ を作る。
const OUT = process.argv[2] || "out";
if (!OUT) throw new Error("出力先ディレクトリを指定してください");

const browser = await chromium.launch(chromeLaunchOptions());

// ---- 手紙（必ず封筒を開いた状態で撮る。閉じたままだと寸法が違う） ----
const p1 = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const box = await openLetter(p1, "file://" + path.join(ROOT, "letter.html"));
await p1.locator(".letter-content").screenshot({ path: path.join(OUT, "letter.png") });
console.log("letter-content:", JSON.stringify(box));

// ---- パンフレットA1面 ----
const p2 = await browser.newPage({ viewport: { width: 1920, height: 1400 } });
await p2.goto("file://" + path.join(ROOT, "tools/pamphlet/pamphlet.html"), { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(1500);
await p2.locator("#panel-a1").screenshot({ path: path.join(OUT, "panel.png") });
console.log("panel:", JSON.stringify(await p2.locator("#panel-a1").boundingBox()));

await browser.close();
process.exit(0);
