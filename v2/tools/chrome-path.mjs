// Chromium の実行ファイルを探す。
//
// 実行環境によって置き場所が変わる（/opt/pw-browsers/chromium だったり
// /opt/pw-browsers/chromium-1194/chrome-linux/chrome だったり、
// Playwright が自分で入れた分だったりする）。各スクリプトに
// パスを直書きしていると、環境が変わるたびに全部直すことになるので、
// ここで見つかったものを使う。
//
//   import { chromeLaunchOptions } from "../chrome-path.mjs";
//   const browser = await chromium.launch(chromeLaunchOptions());
//
// 見つからなければ {} を返す。その場合 Playwright が自前で入れた
// ブラウザを探しに行く（それも無ければ Playwright 側がエラーを出す）。
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOTS = ["/opt/pw-browsers", process.env.PLAYWRIGHT_BROWSERS_PATH].filter(Boolean);
const LEAVES = [
  "chrome-linux/chrome",
  "chrome-linux/headless_shell",
  "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
];

export function findChrome() {
  for (const root of ROOTS) {
    if (!existsSync(root)) continue;
    let entries;
    try { entries = readdirSync(root); } catch { continue; }
    // leaf を外側にして、headless_shell より本体の chrome を優先する。
    // dir は chromium-1194 のような新しい版を先に見るため降順。
    const dirs = entries.sort().reverse();
    for (const leaf of LEAVES) {
      for (const dir of dirs) {
        const p = path.join(root, dir, leaf);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

export function chromeLaunchOptions(extra = {}) {
  const executablePath = findChrome();
  return executablePath ? { executablePath, ...extra } : { ...extra };
}
