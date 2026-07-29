// ホームの「次に向かう場所」と、デバッグの飛ばし機能を確認する。
// リポジトリのルートで:
//
//   node tools/test_home_hint.mjs <スクショの出力先ディレクトリ>
import { chromium } from "playwright";
const OUT = process.argv[2];
const ROOT = "file://" + process.cwd();
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));

// ---- 五十音表つきの在り処謎（⑤をクリアした直後の状態）----
await p.addInitScript(() => {
  if (localStorage.getItem("fuin_team_v1")) return;
  const now = new Date().toISOString();
  localStorage.setItem("fuin_team_v1", JSON.stringify({
    teamId: "T-TEST", teamName: "テスト班", points: {
      5: { firstViewedAt: now, solvedAt: now, wrong: 0 },
    },
  }));
});
await p.goto(ROOT + "/index.html", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(900);

const box = p.locator("#nextPlaceImage");
console.log("カード表示:", await p.locator("#nextPlaceCard").isVisible());
console.log("切り出し:", await box.locator(".arika-crop-wrap").getAttribute("class"));
console.log("ヒントは隠れている:", await p.locator("#nextPlaceHintBox").isHidden());
await p.locator("#nextPlaceCard").scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await p.locator("#nextPlaceCard").screenshot({ path: OUT + "/home_before.png" });

await p.click("#nextPlaceHintBtn");
await p.waitForTimeout(400);
console.log("ヒント表示:", await p.locator("#nextPlaceHintBox").isVisible());
console.log("ヒントの切り出し:", await p.locator("#nextPlaceHintText .arika-crop-wrap").getAttribute("class"));
console.log("ボタンは消えた:", await p.locator("#nextPlaceHintBtn").isHidden());
await p.locator("#nextPlaceCard").screenshot({ path: OUT + "/home_hint.png" });

// ---- 画像ヒントでない在り処謎（①をクリアした状態）----
await p.evaluate(() => {
  const now = new Date().toISOString();
  localStorage.setItem("fuin_team_v1", JSON.stringify({
    teamId: "T-TEST", teamName: "テスト班", points: {
      1: { firstViewedAt: now, solvedAt: now, wrong: 0 },
    },
  }));
});
await p.goto(ROOT + "/index.html", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(700);
await p.click("#nextPlaceHintBtn");
await p.waitForTimeout(300);
console.log("文章ヒント:", await p.locator("#nextPlaceHintText").textContent());

// ---- デバッグの飛ばし ----
// ※ 画面が出そろうまで待つこと。Googleフォントの読み込みが止められる環境では
//    スクリプトの実行が数秒遅れるので、固定の待ち時間だと取りこぼす。
const JUMPS = [
  [1, "扉謎の前", "index.html", "#clearCard"],
  [2, "扉謎のあと", "final.html", "#toSecretBtn"],
  [3, "最後の謎のあと", "secret.html", "#clearCard"],
];
for (const [stage, label, expect, sel] of JUMPS) {
  await p.goto(ROOT + "/index.html?debug=1", { waitUntil: "domcontentloaded" });
  await p.locator('#debugJump button[data-stage="1"]').waitFor();
  await p.click(`#debugJump button[data-stage="${stage}"]`);
  await p.waitForLoadState("load");
  await p.locator(sel).waitFor({ state: "visible", timeout: 15000 });
  const url = p.url().split("/").pop();
  let state = "";
  if (stage === 1) state = "★ " + (await p.locator("#stars .on").count()) + " / 5";
  if (stage === 2) state = (await p.locator("#letterFour").textContent()).trim().slice(0, 12) + "…";
  if (stage === 3) state = (await p.locator("#secretSuccessMsg").textContent()).split("\n")[0];
  console.log(`飛ばし[${label}] → ${url} ${url.startsWith(expect) ? "○" : "×"} ／ ${state}`);
  await p.screenshot({ path: `${OUT}/jump_${stage}.png`, fullPage: true });
}

// 最初から（記録が消えること）
// ※ このページの addInitScript は毎回チームを入れ直してしまうので、
//    別のページ（＝別の初期化スクリプトなし）で確かめる。
const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
await p2.goto(ROOT + "/index.html?debug=1", { waitUntil: "domcontentloaded" });
await p2.locator('#debugJump button[data-stage="2"]').waitFor();
await p2.click('#debugJump button[data-stage="2"]');   // いったん進めてから
await p2.waitForLoadState("load");
await p2.goto(ROOT + "/index.html?debug=1", { waitUntil: "domcontentloaded" });
await p2.locator('#debugJump button[data-stage="0"]').waitFor();
await p2.click('#debugJump button[data-stage="0"]');
await p2.waitForLoadState("load");
await p2.locator("#debugJump").waitFor({ state: "visible", timeout: 15000 });
console.log("飛ばし[最初から] → 記録:", await p2.evaluate(() => localStorage.getItem("fuin_team_v1")),
  "／ 登録画面:", await p2.locator("#register").isVisible());

console.log("JSエラー:", errs.length ? errs : "なし");
await b.close();
process.exit(0);
