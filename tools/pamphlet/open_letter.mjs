// letter.html を開いて、便箋が「開いた状態」で落ち着くまで待つ。
//
// measure_chars.mjs と shoot_overlay.mjs で共通に使う。
//
// ▼ なぜ共通化したか
//   もとは両方が .letter-stage の真ん中あたりを座標指定でクリックしていたが、
//   これは封蝋（#sealBig）に当たったり当たらなかったりする。外れると封筒が
//   閉じたままになり、そのまま測ってしまう。
//   閉じた状態の .letter-content は開いたあとと寸法が違うので、
//   ・文字座標が 0.015 ほどずれる
//   ・背景に敷いた魔法陣の位置（background-position の基準）もずれる
//   という形で、重ね合わせの謎の数値が静かに壊れる。
//   実際これで、合成画像が「ズレていないように見えるのにズレている」
//   状態になっていた。
//
//   そこで封蝋を直接クリックし、.letter-paper.opened が付くのを待ち、
//   さらに便箋が 3:4 に収まっていることを確かめてから返す。
export async function openLetter(page, letterUrl) {
  await page.goto(letterUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await page.locator("#sealBig").click();
  // 封筒が開いて便箋が立ち上がるのを、時間ではなく状態で待つ
  await page.locator(".letter-paper.opened").waitFor({ state: "attached", timeout: 15000 });
  await page.waitForTimeout(1800);   // 行間（--rule-unit）が決まりきるまで

  const box = await page.locator(".letter-content").boundingBox();
  const ratio = box.width / box.height;
  if (Math.abs(ratio - 0.75) > 0.005) {
    throw new Error(
      "便箋が 3:4 になっていない（" + ratio.toFixed(4) + "）。" +
      "封筒が開ききる前に測ろうとしている可能性がある。"
    );
  }
  return box;
}
