// QRコード生成
//
// qrcode-generator （グローバル qrcode）で SVG を生成する薄いラッパー。
// QR規格のクワイエットゾーン（静穏領域）は4モジュール必須。
// margin を 0 にすると読み取り失敗率が上がるため、
// cell size * 4 以上の margin を必ず渡す（例：cell=6 なら margin≥24）。

/**
 * QRコード SVG 文字列を生成する。
 *
 * @param {string} text - QRに埋め込むテキスト
 * @param {Object} options
 * @param {number} options.cell - 1モジュールのピクセルサイズ（デフォルト 6）
 * @param {number} options.margin - クワイエットゾーンのピクセルサイズ（デフォルト 16）
 * @returns {string} SVG 文字列
 */
export function qrSvg(text, { cell = 6, margin = 16 } = {}) {
  if (!window.qrcode) {
    throw new Error(
      'qrcode-generator グローバルが見つかりません。<script src="js/vendor/qrcode-generator.js"> が必要です。'
    );
  }

  // typeNumber 0 = 文字数に応じて自動でサイズを決める
  // "M" = error correction level M (互いに強い誤り訂正)
  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();

  // createSvgTag(cell, margin) は SVG 文字列を返す
  return qr.createSvgTag(cell, margin);
}
