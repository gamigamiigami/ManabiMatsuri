// secret.html（最後の謎）の通し確認。リポジトリのルートで:
//
//   node tools/test_secret.mjs <スクショの出力先ディレクトリ>
//
// 指示文の表示 → 月を魔法陣へドラッグ（消滅演出）→「鍵」を3回たたく
// （破裂演出）→ 合言葉ふたつ → クリア → 開き直しても月が出ないこと、
// までを実際に操作して確かめる。
import { chromium } from "playwright";
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const url = "file://" + process.cwd() + "/secret.html";
await p.addInitScript(() => {
  // すでに保存があるときは上書きしない（開き直しの検証がつぶれるため）
  if (localStorage.getItem("fuin_team_v1")) return;
  localStorage.setItem("fuin_team_v1", JSON.stringify({
    teamId: "T-TEST", name: "テスト", points: {},
    finalGate: { solvedAt: new Date().toISOString() },
  }));
});
await p.goto(url, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);

console.log("見出し:", await p.locator("#introCard h2").textContent());
console.log("声:", (await p.locator("#secretLetter").textContent()).slice(0, 24).replace(/\n/g, " "));
console.log("手がかりの前置き:", (await p.locator("#handoffMsg").textContent()).split("\n")[0]);
console.log("指示①:", await p.locator("#spell1").textContent());
console.log("指示②:", await p.locator("#spell2").textContent());
await p.screenshot({ path: OUT + "/s1.png", fullPage: true });

// ---- 月を魔法陣へ運ぶ ----
const moon = p.locator("#gimmickLayer .moon-free");
console.log("月が層に移った:", await moon.count());
await p.locator("#moonTarget").scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
const mb = await moon.boundingBox();
const cb = await p.locator("#circleCore").boundingBox();
await p.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
await p.mouse.down();
for (let i = 1; i <= 12; i++) {
  await p.mouse.move(
    mb.x + mb.width / 2 + ((cb.x + cb.width / 2 - mb.x - mb.width / 2) * i) / 12,
    mb.y + mb.height / 2 + ((cb.y + cb.height / 2 - mb.y - mb.height / 2) * i) / 12
  );
  await p.waitForTimeout(30);
}
await p.mouse.up();
await p.waitForTimeout(900);
await p.screenshot({ path: OUT + "/s2_moon_vanishing.png" });
await p.waitForTimeout(2600);
console.log("月の残存:", await p.locator("#gimmickLayer .moon-free").count(), "(0なら消滅済み)");
console.log("魔法陣の状態:", await p.locator("#moonTarget").getAttribute("class"));
console.log("説明:", await p.locator("#circleCaption").textContent());
console.log("謎①:", await p.locator("#puzzleCard1 h2").textContent(), "／表示", !(await p.locator("#puzzleCard1").getAttribute("hidden")) );
console.log("入力欄はまだ隠れている:", await p.locator("#secretCard").isHidden());
await p.screenshot({ path: OUT + "/s3.png", fullPage: true });

// ---- 「鍵」を3回たたく ----
const rune = p.locator("#gimmickLayer .key-rune");
for (let i = 0; i < 3; i++) {
  // 文字が十分に見えるまで待ってからたたく
  for (let w = 0; w < 60; w++) {
    const op = await rune.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    if (op >= 0.3) break;
    await p.waitForTimeout(500);
  }
  await rune.dispatchEvent("click");
  await p.waitForTimeout(300);
  if (i < 2) console.log("カウンタ:", await p.locator("#tapCount").textContent());
}
await p.waitForTimeout(400);
console.log("破裂演出:", await p.locator("#gimmickLayer .key-burst").count());
await p.screenshot({ path: OUT + "/s4_key_burst.png" });
await p.waitForTimeout(1600);
console.log("謎②:", await p.locator("#puzzleCard2 h2").textContent());
console.log("入力欄が出た:", await p.locator("#secretCard").isVisible());
console.log("残った鍵:", await p.locator("#gimmickLayer .key-rune").count(), "(0なら消滅済み)");

// ---- 合言葉 ----
await p.fill("#word1", "学校");
await p.fill("#word2", "おやこ");
await p.click("#submitBtn");
await p.waitForTimeout(1800);
console.log("クリア画面:", await p.locator("#clearCard").isVisible());
console.log("結び:", (await p.locator("#secretSuccessMsg").textContent()).split("\n").filter(Boolean).slice(-1));
await p.screenshot({ path: OUT + "/s5_clear.png", fullPage: true });

// ---- 開き直し（月は二度と出ない） ----
await p.goto(url, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(900);
console.log("再訪時の月:", await p.locator("#moon").count(), "(0なら出ない)");
console.log("JSエラー:", errs.length ? errs : "なし");
await b.close();
process.exit(0);
