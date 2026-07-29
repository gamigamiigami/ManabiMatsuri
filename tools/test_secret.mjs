// 最後の謎（大謎）の通し確認。リポジトリのルートで:
//
//   node tools/test_secret.mjs <スクショの出力先ディレクトリ>
//
// 仕掛けはホーム（index.html）にしかない。
//   ホームで月を魔法陣へ運ぶ（消滅演出）→ 謎①が出る
//   ホームで「鍵」を3回たたく（破裂演出）→ 謎②が出る
//   secret.html で合言葉ふたつ → クリア
// までを実際に操作して確かめる。
import { chromium } from "playwright";
import { chromeLaunchOptions } from "./chrome-path.mjs";

// 書き出し先。指定しないと "undefined/" というゴミが出来ていたので、
// 未指定なら実行した場所に out/ を作る。
const OUT = process.argv[2] || "out";
const ROOT = "file://" + process.cwd();
const b = await chromium.launch(chromeLaunchOptions());
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));

// 扉の謎まで解いた状態にする
await p.addInitScript(() => {
  if (localStorage.getItem("fuin_team_v1")) return;
  const now = new Date().toISOString();
  const points = {};
  [1, 2, 3, 4, 5].forEach((q) => { points[q] = { firstViewedAt: now, solvedAt: now, wrong: 0 }; });
  localStorage.setItem("fuin_team_v1", JSON.stringify({
    teamId: "T-TEST", teamName: "テスト班", points,
    finalGate: { solvedAt: now, wrong: 0, hintClicked: false },
  }));
  localStorage.setItem("fuin_letter_seen", "1");
});

// ---- secret.html：手順の表示 ----
await p.goto(ROOT + "/secret.html", { waitUntil: "domcontentloaded" });
await p.locator("#spellCard").waitFor({ state: "visible", timeout: 15000 });
console.log("見出し:", await p.locator("#introCard h2").textContent());
console.log("指示①:", await p.locator("#spell1").textContent());
console.log("指示②:", await p.locator("#spell2").textContent());
console.log("背景の文字:", await p.locator(".scene .runes span").count(), "(0なら無し)");
console.log("この画面の魔法陣:", await p.locator("#moonTarget").count(), "(0なら無し)");
console.log("ホームへ戻るボタン:", await p.locator('#spellCard a[href="index.html"]').isVisible());
await p.screenshot({ path: OUT + "/s1_spell.png", fullPage: true });

// ---- ホーム：① 月を魔法陣へ ----
await p.goto(ROOT + "/index.html", { waitUntil: "domcontentloaded" });
await p.locator("#secretGuideCard").waitFor({ state: "visible", timeout: 15000 });
console.log("\n[ホーム] 場所の一覧が消えている:", await p.locator("#pointList").isHidden());
console.log("[ホーム] 5つの鍵の答えが消えている:", await p.locator("#clearCard").isHidden());
console.log("[ホーム] 冒険の手順が消えている:", await p.locator("#howtoCard").isHidden());
console.log("[ホーム] ★:", await p.locator("#stars .on").count(), "/ 5");
await p.screenshot({ path: OUT + "/s2_home.png", fullPage: true });

const moon = p.locator("#gimmickLayer .moon-free");
console.log("[ホーム] 月がつかめる:", await moon.count());
const target = p.locator(".magic-circle");
const mb = await moon.boundingBox();
const cb = await target.boundingBox();
const to = { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 };
await p.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
await p.mouse.down();
for (let i = 1; i <= 12; i++) {
  await p.mouse.move(
    mb.x + mb.width / 2 + ((to.x - mb.x - mb.width / 2) * i) / 12,
    mb.y + mb.height / 2 + ((to.y - mb.y - mb.height / 2) * i) / 12
  );
  await p.waitForTimeout(30);
}
await p.mouse.up();
await p.waitForTimeout(1000);
await p.screenshot({ path: OUT + "/s3_moon.png" });
await p.locator("#homePuzzleCard1").waitFor({ state: "visible", timeout: 15000 });
await p.waitForTimeout(2200);
console.log("[ホーム] 月の残存:", await p.locator("#gimmickLayer .moon-free").count(), "(0なら消滅)");
console.log("[ホーム] 魔法陣:", await target.getAttribute("class"));
console.log("[ホーム] 謎①:", await p.locator("#homePuzzleTitle1").textContent());

// ---- ホーム：②「鍵」を3回 ----
const rune = p.locator("#gimmickLayer .key-rune");
for (let i = 0; i < 3; i++) {
  for (let w = 0; w < 60; w++) {
    const op = await rune.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    if (op >= 0.3) break;
    await p.waitForTimeout(500);
  }
  await rune.dispatchEvent("click");
  await p.waitForTimeout(300);
  if (i < 2) console.log("[ホーム] 数え:", await p.locator("#secretGuideNote").textContent());
}
await p.waitForTimeout(400);
console.log("[ホーム] 破裂演出:", await p.locator("#gimmickLayer .key-burst").count());
await p.screenshot({ path: OUT + "/s4_key.png" });
await p.locator("#homePuzzleCard2").waitFor({ state: "visible", timeout: 15000 });
console.log("[ホーム] 謎②:", await p.locator("#homePuzzleTitle2").textContent());
console.log("[ホーム] 案内:", await p.locator("#secretGuideNote").textContent());

// ---- 開き直しても仕掛けは戻らない ----
await p.goto(ROOT + "/index.html", { waitUntil: "domcontentloaded" });
await p.locator("#secretGuideCard").waitFor({ state: "visible", timeout: 15000 });
console.log("\n再訪時の月:", await p.locator(".scene .moon, #gimmickLayer .moon-free").count(), "(0なら出ない)");
console.log("再訪時の飾りの鍵:", await p.evaluate(() =>
  [...document.querySelectorAll(".scene .runes span")].filter((e) => e.textContent.trim() === "鍵").length), "(0なら出ない)");
console.log("指示文のチェック:", await p.locator("#homeSpell1.done").count(), await p.locator("#homeSpell2.done").count());

// ---- secret.html：合言葉 ----
await p.goto(ROOT + "/secret.html", { waitUntil: "domcontentloaded" });
await p.locator("#secretCard").waitFor({ state: "visible", timeout: 15000 });
console.log("\n[最後の謎] 謎①②:", await p.locator("#puzzleCard1").isVisible(), await p.locator("#puzzleCard2").isVisible());
await p.fill("#word1", "学校");
await p.fill("#word2", "おやこ");
await p.click("#submitBtn");
await p.locator("#clearCard").waitFor({ state: "visible", timeout: 15000 });
console.log("[最後の謎] クリア:", (await p.locator("#secretSuccessMsg").textContent()).split("\n")[0]);
await p.screenshot({ path: OUT + "/s5_clear.png", fullPage: true });

console.log("JSエラー:", errs.length ? errs : "なし");
await b.close();
process.exit(0);
