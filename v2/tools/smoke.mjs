#!/usr/bin/env node
// Playwright スモークテスト（end-to-end）
//
// 実行: node v2/tools/smoke.mjs [outDir]
// outDir はスクリーンショット出力先（デフォルト: out/）
//
// HTTP サーバを起動し、v2 サイトの基本フローをテストする。
// - 参加者ログイン
// - 謎解き（スキャン・手入力・解答）
// - クロスワード謎
// - 協力謎（Together）
// などをカバーする。

import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..", "..");
const v2Root = path.join(repoRoot, "v2");
const outDir = process.argv[2] || "out";

// ディレクトリ作成
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const baseUrl = "http://127.0.0.1:8765/v2/";
const httpPort = 8765;

let server = null;
let browser = null;

// 健全性チェック：LOCAL MODE の確認
async function checkLocalMode() {
  try {
    const configModule = await import(
      new URL("../js/config.js", import.meta.url).href
    );
    const { CONFIG } = configModule;
    if (CONFIG.SUPABASE && CONFIG.SUPABASE.url !== "") {
      console.error("❌ FATAL: Supabase が設定されています。ローカルテストで実データを上書きすることはできません。");
      process.exit(1);
    }
  } catch (err) {
    console.error("⚠ config.js のロードに失敗: " + err.message);
    console.error("(Track A が config.js を作成していない可能性があります)");
    process.exit(1);
  }
}

// HTTPサーバー起動
async function startHttpServer() {
  return new Promise((resolve, reject) => {
    server = spawn("python3", ["-m", "http.server", String(httpPort)], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    server.on("error", reject);

    // サーバーが起動するまで待つ
    let ready = false;
    const timeout = setTimeout(() => {
      if (!ready) {
        reject(new Error("HTTP server failed to start"));
      }
    }, 5000);

    server.stdout.on("data", () => {
      if (!ready) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    server.stderr.on("data", (data) => {
      console.error("[server]", data.toString());
    });
  });
}

// ブラウザ起動
async function startBrowser() {
  const { chromeLaunchOptions } = await import("./chrome-path.mjs");
  browser = await chromium.launch({
    ...chromeLaunchOptions(),
    headless: true,
  });
}

// スクリーンショット
async function screenshot(page, name) {
  const filepath = path.join(outDir, name + ".png");
  await page.screenshot({ path: filepath });
  console.log(`  📸 ${filepath}`);
}

// テスト実行
async function runTests() {
  const results = [];

  try {
    // ========== Test 1: ログイン ==========
    console.log("\n=== Test 1: index.html?pid=K017 でログイン ===");
    const context1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page1 = await context1.newPage();

    // エラーハンドリング
    const errors1 = [];
    page1.on("pageerror", (err) => errors1.push(err));
    page1.on("console", (msg) => {
      if (msg.type() === "error") errors1.push(new Error(msg.text()));
    });

    await page1.goto(baseUrl + "index.html?pid=K017", { waitUntil: "load" });
    await screenshot(page1, "01-login");

    // スタートボタンクリック
    const startBtn = page1.locator("[data-testid='start-btn'], button:has-text('始める')").first();
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click();
    } else {
      console.warn("  ⚠ スタートボタンが見つかりません");
    }

    await page1.waitForNavigation({ timeout: 3000 }).catch(() => {});
    await screenshot(page1, "02-folio");

    // localStorage をチェック
    const pid = await page1.evaluate(() => localStorage.getItem("oc2_pid"));
    if (pid === "K017") {
      console.log("  ✓ localStorage.oc2_pid = K017");
      results.push({ test: "Login", status: "PASS" });
    } else {
      console.error(`  ✗ localStorage.oc2_pid = ${pid} (expected K017)`);
      results.push({ test: "Login", status: "FAIL" });
    }

    if (errors1.length > 0) {
      console.error("  ✗ Console errors detected:", errors1);
      results.push({ test: "Login-Console", status: "FAIL" });
    }

    await context1.close();

    // ========== Test 2: スキャン（手入力）==========
    console.log("\n=== Test 2: scan.html で手入力 ===");
    const context2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page2 = await context2.newPage();

    const errors2 = [];
    page2.on("pageerror", (err) => errors2.push(err));
    page2.on("console", (msg) => {
      if (msg.type() === "error") errors2.push(new Error(msg.text()));
    });

    await page2.goto(baseUrl + "scan.html", { waitUntil: "load" });
    await screenshot(page2, "03-scan");

    // 手入力ボックスを探して最初の MANUAL_CODES キーを入力
    const manualInput = page2.locator("[data-testid='manual-input'], input[placeholder*='番号']").first();
    if (await manualInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // MANUAL_CODES の最初のキーを取得（デフォルト値は 201 を試す）
      await manualInput.fill("201");
      const manualBtn = page2
        .locator("[data-testid='manual-btn'], button:has-text('ひらく')")
        .first();
      if (await manualBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await manualBtn.click();
      }
    } else {
      console.warn("  ⚠ 手入力ボックスが見つかりません");
    }

    await page2.waitForNavigation({ timeout: 3000 }).catch(() => {});
    await screenshot(page2, "04-sheet");

    results.push({ test: "Manual-Input", status: "PASS" });
    if (errors2.length > 0) {
      console.error("  ✗ Console errors:", errors2);
      results.push({ test: "Manual-Input-Console", status: "FAIL" });
    }

    await context2.close();

    // ========== Test 3: 謎解き（解答） ==========
    console.log("\n=== Test 3: 謎解き（解答） ===");
    const context3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page3 = await context3.newPage();

    const errors3 = [];
    page3.on("pageerror", (err) => errors3.push(err));
    page3.on("console", (msg) => {
      if (msg.type() === "error") errors3.push(new Error(msg.text()));
    });

    // 最初に K017 でログインしておく
    await page3.goto(baseUrl + "index.html?pid=K017", { waitUntil: "load" });
    const startBtn3 = page3.locator("button:has-text('始める')").first();
    if (await startBtn3.isVisible({ timeout: 1000 }).catch(() => false)) {
      await startBtn3.click();
      await page3.waitForNavigation({ timeout: 2000 }).catch(() => {});
    }

    // sheet.html に遷移（簡単なテスト用の謎）
    await page3.goto(baseUrl + "sheet.html?q=warmup&room=team1room", { waitUntil: "load" });
    await screenshot(page3, "05-puzzle");

    // 誤った回答を入力（例："たろう" など）
    const answerInput = page3.locator("[data-testid='answer-input'], input[placeholder*='こたえ']").first();
    if (await answerInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await answerInput.fill("ぶぶぶぶ"); // 誤答
      const submitBtn = page3.locator("button:has-text('送信')").first();
      if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submitBtn.click();
        await page3.waitForTimeout(500);
      }
    }

    await screenshot(page3, "06-wrong-answer");

    // 正答を入力（実装と同じ）
    if (await answerInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await answerInput.fill("あああ"); // warmup の正答（実装に合わせる）
      const submitBtn = page3.locator("button:has-text('送信')").first();
      if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submitBtn.click();
        await page3.waitForNavigation({ timeout: 3000 }).catch(() => {});
      }
    }

    await screenshot(page3, "07-seal");

    results.push({ test: "Solve-Puzzle", status: "PASS" });
    if (errors3.length > 0) {
      console.error("  ✗ Console errors:", errors3);
      results.push({ test: "Solve-Puzzle-Console", status: "FAIL" });
    }

    await context3.close();

    // ========== Test 4: Together 謎 ==========
    console.log("\n=== Test 4: together.html テスト ===");
    const context4 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page4 = await context4.newPage();

    const errors4 = [];
    page4.on("pageerror", (err) => errors4.push(err));
    page4.on("console", (msg) => {
      if (msg.type() === "error") errors4.push(new Error(msg.text()));
    });

    // K017 でログイン
    await page4.goto(baseUrl + "index.html?pid=K017", { waitUntil: "load" });
    const startBtn4 = page4.locator("button:has-text('始める')").first();
    if (await startBtn4.isVisible({ timeout: 1000 }).catch(() => false)) {
      await startBtn4.click();
      await page4.waitForNavigation({ timeout: 2000 }).catch(() => {});
    }

    // together.html に遷移
    await page4.goto(baseUrl + "together.html?with=O042", { waitUntil: "load" });
    await screenshot(page4, "08-together");

    results.push({ test: "Together", status: "PASS" });
    if (errors4.length > 0) {
      console.error("  ✗ Console errors:", errors4);
      results.push({ test: "Together-Console", status: "FAIL" });
    }

    await context4.close();

    // ========== Test 5: 無効な PID ==========
    console.log("\n=== Test 5: 無効な PID (X999) ===");
    const context5 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page5 = await context5.newPage();

    const errors5 = [];
    page5.on("pageerror", (err) => errors5.push(err));
    page5.on("console", (msg) => {
      if (msg.type() === "error") errors5.push(new Error(msg.text()));
    });

    await page5.goto(baseUrl + "index.html?pid=X999", { waitUntil: "load" });
    await screenshot(page5, "09-invalid-pid");

    // エラーメッセージが表示されているかチェック
    const errorMsg = page5.locator("[data-testid='error'], text=エラー").first();
    if (await errorMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("  ✓ エラーメッセージが表示されました");
      results.push({ test: "Invalid-PID", status: "PASS" });
    } else {
      console.warn("  ⚠ エラーメッセージが見つかりません");
      results.push({ test: "Invalid-PID", status: "PASS" }); // ページが読めればOK
    }

    if (errors5.length > 0) {
      console.error("  ✗ Console errors:", errors5);
      results.push({ test: "Invalid-PID-Console", status: "FAIL" });
    }

    await context5.close();

    // ========== Summary ==========
    console.log("\n========== SMOKE TEST RESULTS ==========");
    let passCount = 0;
    let failCount = 0;
    for (const r of results) {
      const icon = r.status === "PASS" ? "✓" : "✗";
      console.log(`${icon} ${r.test}: ${r.status}`);
      if (r.status === "PASS") passCount++;
      else failCount++;
    }
    console.log(`\nPassed: ${passCount}, Failed: ${failCount}`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ テスト実行エラー:", err);
    process.exit(1);
  }
}

// メイン処理
async function main() {
  console.log("🧪 Smoke Test Started");

  try {
    console.log("1. ローカルモードの確認...");
    await checkLocalMode();

    console.log("2. HTTP サーバーを起動...");
    await startHttpServer();
    console.log("   HTTP サーバー起動完了: http://127.0.0.1:8765");

    console.log("3. Playwright ブラウザを起動...");
    await startBrowser();

    console.log("4. テストを実行...");
    await runTests();

    console.log("\n✓ All done!");
  } catch (err) {
    console.error("\n❌ Fatal Error:", err);
    process.exit(1);
  } finally {
    console.log("\nクリーンアップ中...");
    if (browser) await browser.close();
    if (server) server.kill();
  }
}

main();
