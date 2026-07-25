// ========================================
// Xからの手紙・背景デザイン（透かし）
//
// 手紙の紙面（文字の後ろ）に敷く装飾のカタログ。
// 今後の謎解きのギミックに使えるよう、1つずつ独立した「モチーフ」として
// 定義してあり、好きな組み合わせを選んで適用できる。
//
// ▼ 使い方
//   <div class="letter" data-decor="magicCircle,runeBand"></div>
//   のように data-decor で指定する（カンマ区切り・上に書いたものが手前）。
//   data-decor を書かない場合は DEFAULT_DECOR が使われる。
//   data-decor="none" にすると装飾なし。
//
// ▼ 仕組み
//   要素の background-image に SVG を重ねる方式なので、
//   textContent で本文を差し替えても装飾が消えない。
//
// ▼ 全モチーフの見本
//   tools/letter-decor.html をブラウザで開くと一覧で見比べられる。
// ========================================

(function (global) {
  "use strict";

  // 紙に印刷されたインクの色（羊皮紙になじむ濃さにしてある）
  var INK = "rgba(60,40,20,0.42)";
  var INK_SOFT = "rgba(60,40,20,0.26)";
  var INK_FAINT = "rgba(60,40,20,0.16)";
  var RED = "rgba(122,31,44,0.34)";

  function svg(viewBox, inner) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + inner + "</svg>"
    );
  }

  // 円周上に要素を並べるための座標計算
  function ring(cx, cy, r, count, fn) {
    var out = "";
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 * i) / count - Math.PI / 2;
      out += fn(cx + Math.cos(a) * r, cy + Math.sin(a) * r, (a * 180) / Math.PI + 90, i);
    }
    return out;
  }

  function polygonPoints(cx, cy, r, n, rot) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 * i) / n - Math.PI / 2 + (rot || 0);
      pts.push((cx + Math.cos(a) * r).toFixed(1) + "," + (cy + Math.sin(a) * r).toFixed(1));
    }
    return pts.join(" ");
  }

  // 星形（n芒星：頂点を skip 個飛ばしで結ぶ）
  function starPath(cx, cy, r, n, skip) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var idx = (i * skip) % n;
      var a = (Math.PI * 2 * idx) / n - Math.PI / 2;
      pts.push((cx + Math.cos(a) * r).toFixed(1) + "," + (cy + Math.sin(a) * r).toFixed(1));
    }
    return pts.join(" ");
  }

  var RUNES = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", "ᛁ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛊ", "ᛏ", "ᛒ", "ᛖ", "ᛗ", "ᛚ", "ᛜ", "ᛞ", "ᛟ"];

  // ========================================
  // モチーフ定義
  //   svg      : SVG本体
  //   size     : background-size
  //   position : background-position
  //   repeat   : background-repeat
  // ========================================
  var MOTIFS = {
    // ---- 1. 魔法陣（中央の大きな透かし） ----
    magicCircle: {
      name: "魔法陣",
      note: "中央に大きく敷く定番の透かし。文字が乗っても読める濃さ。",
      size: "78% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1">' +
        '<circle cx="100" cy="100" r="94"/>' +
        '<circle cx="100" cy="100" r="88"/>' +
        '<circle cx="100" cy="100" r="62"/>' +
        '<circle cx="100" cy="100" r="30"/>' +
        '<polygon points="' + polygonPoints(100, 100, 88, 3, 0) + '"/>' +
        '<polygon points="' + polygonPoints(100, 100, 88, 3, Math.PI) + '"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '" font-family="serif" font-size="9" text-anchor="middle">' +
        ring(100, 100, 75, 12, function (x, y, rot, i) {
          return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" transform="rotate(' + rot.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')">' + RUNES[i * 2 % RUNES.length] + "</text>";
        }) +
        "</g>"),
    },

    // ---- 2. 星座図 ----
    constellation: {
      name: "星座図",
      note: "星と結び線。星の位置そのものを暗号に使える。",
      size: "88% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 240 180",
        '<g stroke="' + INK_SOFT + '" stroke-width="0.9" fill="none">' +
        '<path d="M24,140 L58,96 L96,110 L130,64 L172,78 L208,40"/>' +
        '<path d="M58,96 L70,50 L110,28"/>' +
        '<path d="M130,64 L142,118 L186,140"/>' +
        "</g>" +
        '<g fill="' + INK + '">' +
        '<circle cx="24" cy="140" r="3"/><circle cx="58" cy="96" r="4"/>' +
        '<circle cx="96" cy="110" r="2.6"/><circle cx="130" cy="64" r="4.4"/>' +
        '<circle cx="172" cy="78" r="3"/><circle cx="208" cy="40" r="3.4"/>' +
        '<circle cx="70" cy="50" r="2.6"/><circle cx="110" cy="28" r="3.2"/>' +
        '<circle cx="142" cy="118" r="2.8"/><circle cx="186" cy="140" r="3.6"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '">' +
        '<circle cx="40" cy="40" r="1.4"/><circle cx="200" cy="120" r="1.4"/>' +
        '<circle cx="150" cy="160" r="1.2"/><circle cx="90" cy="160" r="1.2"/>' +
        '<circle cx="220" cy="90" r="1.2"/><circle cx="12" cy="80" r="1.2"/>' +
        "</g>"),
    },

    // ---- 3. ルーン文字の帯（上下） ----
    runeBand: {
      name: "ルーンの帯",
      note: "上下に走る古代文字の帯。文章と干渉しにくい。",
      size: "100% auto",
      position: "center top, center bottom",
      repeat: "no-repeat",
      svg: svg("0 0 300 40",
        '<g stroke="' + INK_FAINT + '" stroke-width="0.8">' +
        '<line x1="0" y1="6" x2="300" y2="6"/><line x1="0" y1="34" x2="300" y2="34"/>' +
        "</g>" +
        '<g fill="' + INK_SOFT + '" font-family="serif" font-size="15" text-anchor="middle">' +
        (function () {
          var o = "";
          for (var i = 0; i < 18; i++) {
            o += '<text x="' + (10 + i * 16.5) + '" y="26">' + RUNES[i % RUNES.length] + "</text>";
          }
          return o;
        })() +
        "</g>"),
      // 上下2箇所に敷くので、この モチーフだけ2レイヤー使う
      layers: 2,
      sizes: ["100% auto", "100% auto"],
      positions: ["center top", "center bottom"],
    },

    // ---- 4. 錬金術の元素記号 ----
    alchemy: {
      name: "錬金術記号",
      note: "火・水・風・地の四大元素。四隅に置くと収まりがいい。",
      size: "100% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 260 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.2">' +
        // 火（△）
        '<polygon points="' + polygonPoints(40, 42, 22, 3, 0) + '"/>' +
        // 水（▽）
        '<polygon points="' + polygonPoints(220, 42, 22, 3, Math.PI) + '"/>' +
        // 風（△＋横線）
        '<polygon points="' + polygonPoints(40, 158, 22, 3, 0) + '"/>' +
        '<line x1="26" y1="164" x2="54" y2="164"/>' +
        // 地（▽＋横線）
        '<polygon points="' + polygonPoints(220, 158, 22, 3, Math.PI) + '"/>' +
        '<line x1="206" y1="152" x2="234" y2="152"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '" font-family="serif" font-size="20" text-anchor="middle">' +
        '<text x="130" y="36">☉</text><text x="130" y="176">☾</text>' +
        '<text x="92" y="106">☿</text><text x="168" y="106">♄</text>' +
        "</g>"),
    },

    // ---- 5. 月の満ち欠け ----
    moonPhases: {
      name: "月の満ち欠け",
      note: "並んだ月。順番・形そのものを暗号に使いやすい。",
      size: "82% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 300 60",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.1">' +
        (function () {
          var o = "";
          for (var i = 0; i < 8; i++) {
            var cx = 26 + i * 36;
            o += '<circle cx="' + cx + '" cy="30" r="15"/>';
            // 満ち欠けの影
            var k = (i / 7) * 2 - 1; // -1..1
            var rx = Math.abs(k) * 15;
            var sweep = k > 0 ? 1 : 0;
            o += '<path d="M' + cx + ',15 A' + rx.toFixed(1) + ',15 0 0,' + sweep + ' ' + cx + ',45 A15,15 0 0,' + (k > 0 ? 0 : 1) + ' ' + cx + ',15 Z" fill="' + INK_FAINT + '" stroke="none"/>';
          }
          return o;
        })() +
        "</g>"),
    },

    // ---- 6. 羅針盤 ----
    compass: {
      name: "羅針盤",
      note: "方角を示すコンパスローズ。「北」を手がかりにする謎と相性◎。",
      size: "62% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1">' +
        '<circle cx="100" cy="100" r="86"/><circle cx="100" cy="100" r="70"/>' +
        '<circle cx="100" cy="100" r="16"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '" stroke="none">' +
        '<polygon points="100,18 110,92 100,100 90,92"/>' +
        '<polygon points="100,182 110,108 100,100 90,108"/>' +
        '<polygon points="18,100 92,110 100,100 92,90"/>' +
        '<polygon points="182,100 108,110 100,100 108,90"/>' +
        "</g>" +
        '<g fill="' + INK_SOFT + '" stroke="none" opacity="0.75">' +
        '<polygon points="158,42 116,84 100,100 84,116"/>' +
        '<polygon points="42,158 84,116 100,100 116,84"/>' +
        "</g>" +
        '<g fill="' + INK + '" font-family="serif" font-size="13" text-anchor="middle">' +
        '<text x="100" y="12">N</text><text x="100" y="196">S</text>' +
        '<text x="192" y="105">E</text><text x="8" y="105">W</text>' +
        "</g>" +
        '<g stroke="' + INK_FAINT + '" stroke-width="0.7">' +
        ring(100, 100, 78, 24, function (x, y) {
          return '<line x1="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (100 + (x - 100) * 0.92).toFixed(1) + '" y2="' + (100 + (y - 100) * 0.92).toFixed(1) + '"/>';
        }) +
        "</g>"),
    },

    // ---- 7. 蔦（四隅の植物装飾） ----
    vines: {
      name: "蔦の四隅飾り",
      note: "四隅を飾る植物。中央が空くので長文でも読みやすい。",
      size: "100% 100%",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 260",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.1">' +
        '<path d="M6,6 C40,10 52,30 50,54 C48,72 34,78 28,68 C22,58 34,48 44,54"/>' +
        '<path d="M6,6 C10,40 30,52 54,50"/>' +
        '<path d="M194,6 C160,10 148,30 150,54 C152,72 166,78 172,68 C178,58 166,48 156,54"/>' +
        '<path d="M194,6 C190,40 170,52 146,50"/>' +
        '<path d="M6,254 C40,250 52,230 50,206 C48,188 34,182 28,192 C22,202 34,212 44,206"/>' +
        '<path d="M6,254 C10,220 30,208 54,210"/>' +
        '<path d="M194,254 C160,250 148,230 150,206 C152,188 166,182 172,192 C178,202 166,212 156,206"/>' +
        '<path d="M194,254 C190,220 170,208 146,210"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '">' +
        '<ellipse cx="34" cy="26" rx="7" ry="4" transform="rotate(35 34 26)"/>' +
        '<ellipse cx="166" cy="26" rx="7" ry="4" transform="rotate(-35 166 26)"/>' +
        '<ellipse cx="34" cy="234" rx="7" ry="4" transform="rotate(-35 34 234)"/>' +
        '<ellipse cx="166" cy="234" rx="7" ry="4" transform="rotate(35 166 234)"/>' +
        "</g>"),
    },

    // ---- 8. 生命の花（神聖幾何学） ----
    flowerOfLife: {
      name: "生命の花",
      note: "重なる円の幾何学模様。全面に敷いても上品。",
      size: "56% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_FAINT + '" stroke-width="0.9">' +
        '<circle cx="100" cy="100" r="30"/>' +
        ring(100, 100, 30, 6, function (x, y) {
          return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="30"/>';
        }) +
        ring(100, 100, 52, 6, function (x, y) {
          return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="30"/>';
        }) +
        ring(100, 100, 60, 6, function (x, y) {
          return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="30"/>';
        }) +
        '<circle cx="100" cy="100" r="92" stroke="' + INK_SOFT + '"/>' +
        "</g>"),
    },

    // ---- 9. 古地図風の枠 ----
    mapFrame: {
      name: "古地図の枠",
      note: "二重罫＋四隅の飾り。中に別の図を入れる土台にも。",
      size: "100% 100%",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 260",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.1">' +
        '<rect x="7" y="7" width="186" height="246"/>' +
        '<rect x="13" y="13" width="174" height="234" stroke="' + INK_FAINT + '" stroke-width="0.8"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1">' +
        '<path d="M7,26 L26,7"/><path d="M174,7 L193,26"/>' +
        '<path d="M7,234 L26,253"/><path d="M174,253 L193,234"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '">' +
        '<circle cx="16.5" cy="16.5" r="3"/><circle cx="183.5" cy="16.5" r="3"/>' +
        '<circle cx="16.5" cy="243.5" r="3"/><circle cx="183.5" cy="243.5" r="3"/>' +
        "</g>"),
    },

    // ---- 10. 砂時計 ----
    hourglass: {
      name: "砂時計",
      note: "時間・順番をほのめかすモチーフ。制限時間の演出にも。",
      size: "36% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 120 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.4">' +
        '<rect x="20" y="10" width="80" height="8" rx="3"/>' +
        '<rect x="20" y="182" width="80" height="8" rx="3"/>' +
        '<path d="M30,18 C30,64 60,88 60,100 C60,112 30,136 30,182"/>' +
        '<path d="M90,18 C90,64 60,88 60,100 C60,112 90,136 90,182"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '" stroke="none">' +
        '<path d="M36,30 C36,62 60,86 60,98 C60,86 84,62 84,30 Z" opacity="0.7"/>' +
        '<path d="M40,176 C40,150 60,132 60,124 C60,132 80,150 80,176 Z"/>' +
        "</g>" +
        '<line x1="60" y1="100" x2="60" y2="140" stroke="' + INK_FAINT + '" stroke-width="1" stroke-dasharray="2 5"/>'),
    },

    // ---- 11. 鍵の透かし ----
    keyWatermark: {
      name: "鍵の透かし",
      note: "斜めに横切る大きな鍵。「封印の鍵」の世界観そのもの。",
      size: "58% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g transform="rotate(-32 100 100)" fill="none" stroke="' + INK_SOFT + '" stroke-width="2">' +
        '<circle cx="58" cy="100" r="26"/>' +
        '<circle cx="58" cy="100" r="12"/>' +
        '<line x1="84" y1="100" x2="172" y2="100"/>' +
        '<path d="M150,100 L150,120"/>' +
        '<path d="M162,100 L162,116"/>' +
        '<path d="M172,100 L172,124"/>' +
        "</g>"),
    },

    // ---- 12. 五芒星／六芒星 ----
    pentagram: {
      name: "星の紋章",
      note: "五芒星と六芒星。魔術っぽさを強く出したいときに。",
      size: "52% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.2">' +
        '<circle cx="100" cy="100" r="80"/>' +
        '<polygon points="' + starPath(100, 100, 80, 5, 2) + '"/>' +
        '<circle cx="100" cy="100" r="46" stroke="' + INK_FAINT + '"/>' +
        '<polygon points="' + polygonPoints(100, 100, 46, 3, 0) + '" stroke="' + INK_FAINT + '"/>' +
        '<polygon points="' + polygonPoints(100, 100, 46, 3, Math.PI) + '" stroke="' + INK_FAINT + '"/>' +
        "</g>"),
    },

    // ---- 13. 蛾（ミステリアス寄り） ----
    moth: {
      name: "夜の蛾",
      note: "少し不気味さのあるアクセント。Xの怪しさを出したいときに。",
      size: "42% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 160",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.1">' +
        '<path d="M100,44 C70,14 24,22 22,58 C20,92 62,102 100,86"/>' +
        '<path d="M100,44 C130,14 176,22 178,58 C180,92 138,102 100,86"/>' +
        '<path d="M100,86 C74,92 46,110 52,134 C58,154 88,146 100,118"/>' +
        '<path d="M100,86 C126,92 154,110 148,134 C142,154 112,146 100,118"/>' +
        '<line x1="100" y1="40" x2="100" y2="122"/>' +
        '<path d="M100,40 C94,26 84,20 76,18"/>' +
        '<path d="M100,40 C106,26 116,20 124,18"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '">' +
        '<circle cx="56" cy="56" r="7"/><circle cx="144" cy="56" r="7"/>' +
        '<circle cx="74" cy="126" r="4"/><circle cx="126" cy="126" r="4"/>' +
        "</g>"),
    },

    // ---- 14. 波紋 ----
    ripples: {
      name: "波紋",
      note: "静かな同心円。うるさくないので長文と相性がいい。",
      size: "76% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_FAINT + '" stroke-width="0.9">' +
        (function () {
          var o = "";
          for (var i = 1; i <= 9; i++) o += '<circle cx="100" cy="100" r="' + i * 10 + '"/>';
          return o;
        })() +
        "</g>" +
        '<g fill="none" stroke="' + INK_FAINT + '" stroke-width="0.7" opacity="0.7">' +
        (function () {
          var o = "";
          for (var i = 1; i <= 5; i++) o += '<circle cx="44" cy="52" r="' + i * 7 + '"/>';
          for (var j = 1; j <= 5; j++) o += '<circle cx="158" cy="150" r="' + j * 7 + '"/>';
          return o;
        })() +
        "</g>"),
    },

    // ---- 15. 時計の文字盤 ----
    clockDial: {
      name: "時計の文字盤",
      note: "数字が並ぶので、時刻を答えにする謎に直結させやすい。",
      size: "58% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.1">' +
        '<circle cx="100" cy="100" r="88"/><circle cx="100" cy="100" r="80"/>' +
        "</g>" +
        '<g stroke="' + INK_SOFT + '" stroke-width="1.4">' +
        ring(100, 100, 76, 12, function (x, y) {
          return '<line x1="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (100 + (x - 100) * 0.88).toFixed(1) + '" y2="' + (100 + (y - 100) * 0.88).toFixed(1) + '"/>';
        }) +
        "</g>" +
        '<g fill="' + INK + '" font-family="serif" font-size="14" text-anchor="middle" dominant-baseline="middle">' +
        ring(100, 100, 62, 12, function (x, y, rot, i) {
          var n = i === 0 ? 12 : i;
          return '<text x="' + x.toFixed(1) + '" y="' + (y + 1).toFixed(1) + '">' + n + "</text>";
        }) +
        "</g>" +
        '<g stroke="' + INK_SOFT + '" stroke-width="2.4" stroke-linecap="round">' +
        '<line x1="100" y1="100" x2="100" y2="52"/>' +
        '<line x1="100" y1="100" x2="138" y2="118"/>' +
        "</g>" +
        '<circle cx="100" cy="100" r="4" fill="' + INK + '"/>'),
    },

    // ---- 16. 世界樹 ----
    worldTree: {
      name: "世界樹",
      note: "枝分かれが美しい大樹。分岐をたどる謎に使える。",
      size: "72% auto",
      position: "center bottom",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.6" stroke-linecap="round">' +
        '<path d="M100,196 L100,120"/>' +
        '<path d="M100,150 C86,140 70,138 58,124"/>' +
        '<path d="M100,150 C114,140 130,138 142,124"/>' +
        '<path d="M100,126 C88,112 76,106 66,92"/>' +
        '<path d="M100,126 C112,112 124,106 134,92"/>' +
        '<path d="M100,120 L100,86"/>' +
        '<path d="M100,96 C90,84 84,74 82,60"/>' +
        '<path d="M100,96 C110,84 116,74 118,60"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_FAINT + '" stroke-width="1">' +
        '<path d="M58,124 C48,118 42,110 40,100"/><path d="M142,124 C152,118 158,110 160,100"/>' +
        '<path d="M66,92 C58,84 54,74 54,64"/><path d="M134,92 C142,84 146,74 146,64"/>' +
        '<circle cx="100" cy="86" r="46"/>' +
        '<path d="M100,196 C80,190 66,186 54,182"/><path d="M100,196 C120,190 134,186 146,182"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '">' +
        '<circle cx="82" cy="58" r="3.4"/><circle cx="118" cy="58" r="3.4"/>' +
        '<circle cx="54" cy="62" r="3"/><circle cx="146" cy="62" r="3"/>' +
        '<circle cx="40" cy="98" r="2.6"/><circle cx="160" cy="98" r="2.6"/>' +
        "</g>"),
    },

    // ---- 17. 迷路 ----
    labyrinth: {
      name: "迷宮",
      note: "渦巻き状の迷路。道順を答えにする謎の下地に。",
      size: "60% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.6">' +
        (function () {
          var o = "";
          for (var i = 0; i < 7; i++) {
            var r = 88 - i * 12;
            var gap = 18 + i * 24;
            var a0 = (gap * Math.PI) / 180;
            var a1 = a0 + (322 * Math.PI) / 180;
            var x0 = 100 + Math.cos(a0) * r, y0 = 100 + Math.sin(a0) * r;
            var x1 = 100 + Math.cos(a1) * r, y1 = 100 + Math.sin(a1) * r;
            o += '<path d="M' + x0.toFixed(1) + ',' + y0.toFixed(1) + ' A' + r + ',' + r + ' 0 1,1 ' + x1.toFixed(1) + ',' + y1.toFixed(1) + '"/>';
          }
          return o;
        })() +
        '<circle cx="100" cy="100" r="5" fill="' + INK_FAINT + '" stroke="none"/>' +
        "</g>"),
    },

    // ---- 18. 星屑（散らし） ----
    stardust: {
      name: "星屑",
      note: "全面にちらす小さな星。他のモチーフと重ねる用。",
      size: "120px 120px",
      position: "center",
      repeat: "repeat",
      svg: svg("0 0 120 120",
        '<g fill="' + INK_FAINT + '">' +
        '<circle cx="18" cy="24" r="1.6"/><circle cx="72" cy="12" r="1.1"/>' +
        '<circle cx="104" cy="46" r="1.5"/><circle cx="42" cy="62" r="1.2"/>' +
        '<circle cx="88" cy="86" r="1.7"/><circle cx="26" cy="98" r="1.3"/>' +
        '<circle cx="60" cy="108" r="1.1"/><circle cx="8" cy="70" r="1.2"/>' +
        "</g>" +
        '<g stroke="' + INK_FAINT + '" stroke-width="0.7">' +
        '<path d="M72,6 L72,18 M66,12 L78,12"/>' +
        '<path d="M42,56 L42,68 M36,62 L48,62"/>' +
        "</g>"),
    },

    // ---- 19. 罫線（写経風） ----
    ruledLines: {
      name: "罫線",
      note: "紙らしさを足すだけの控えめな線。単体では弱いので重ねて使う。",
      size: "100% 32px",
      position: "center top",
      repeat: "repeat-y",
      svg: svg("0 0 100 32",
        '<line x1="0" y1="31" x2="100" y2="31" stroke="' + INK_FAINT + '" stroke-width="0.6"/>'),
    },

    // ---- 20. 封蝋の押し跡（赤） ----
    sealStamp: {
      name: "封蝋の跡",
      note: "赤インクの丸印。Xの署名がわりに。",
      size: "26% auto",
      position: "88% 12%",
      repeat: "no-repeat",
      svg: svg("0 0 120 120",
        '<g fill="none" stroke="' + RED + '" stroke-width="2.4">' +
        '<circle cx="60" cy="60" r="52" stroke-dasharray="6 4"/>' +
        '<circle cx="60" cy="60" r="42"/>' +
        "</g>" +
        '<text x="60" y="76" fill="' + RED + '" font-family="serif" font-size="46" text-anchor="middle">X</text>'),
    },

    // ==========================================================
    // 追加分：魔法使い感の強いモチーフ
    // ==========================================================

    // ---- 21. アストロラーベ ----
    astrolabe: {
      name: "アストロラーベ",
      note: "中世の天体観測儀。目盛と回転盤が「かっこいい魔術師」の空気。",
      size: "66% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.2">' +
        '<circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="83"/>' +
        '<circle cx="100" cy="100" r="62"/><circle cx="100" cy="100" r="13"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_FAINT + '" stroke-width="1">' +
        '<circle cx="100" cy="86" r="47"/><circle cx="100" cy="72" r="30"/>' +
        '<line x1="17" y1="100" x2="183" y2="100"/><line x1="100" y1="17" x2="100" y2="183"/>' +
        "</g>" +
        '<g stroke="' + INK_SOFT + '" stroke-width="0.8">' +
        ring(100, 100, 92, 36, function (x, y) {
          return '<line x1="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (100 + (x - 100) * 0.9).toFixed(1) + '" y2="' + (100 + (y - 100) * 0.9).toFixed(1) + '"/>';
        }) +
        "</g>" +
        '<g transform="rotate(-27 100 100)" fill="none" stroke="' + INK + '" stroke-width="1.3">' +
        '<rect x="22" y="95.5" width="156" height="9" rx="4.5"/>' +
        '<circle cx="42" cy="100" r="3.6"/><circle cx="158" cy="100" r="3.6"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.1">' +
        '<path d="M100,38 C112,44 118,54 112,62"/>' +
        '<path d="M46,120 C56,128 68,128 74,120"/>' +
        '<path d="M152,124 C144,132 132,132 126,124"/>' +
        "</g>" +
        '<g fill="' + INK + '">' +
        '<circle cx="112" cy="62" r="2.8"/><circle cx="74" cy="120" r="2.8"/><circle cx="126" cy="124" r="2.8"/>' +
        "</g>"),
    },

    // ---- 22. ウロボロス ----
    ouroboros: {
      name: "ウロボロス",
      note: "自らの尾を噛む蛇。「終わりと始まり」の象徴で見栄えも強い。",
      size: "60% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<path d="M170.7,133.0 A78,78 0 1,1 170.7,67.0 L154.4,74.6 A60,60 0 1,0 154.4,125.4 Z" ' +
        'fill="none" stroke="' + INK_SOFT + '" stroke-width="1.6"/>' +
        '<path d="M158,54 L196,66 L170,92 L161,73 Z" fill="none" stroke="' + INK_SOFT + '" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<circle cx="173" cy="68" r="2.6" fill="' + INK + '"/>' +
        '<g fill="' + INK_FAINT + '">' +
        ring(100, 100, 69, 20, function (x, y, rot, i) {
          if (i > 16) return "";
          return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2"/>';
        }) +
        "</g>" +
        '<circle cx="100" cy="100" r="44" fill="none" stroke="' + INK_FAINT + '" stroke-width="0.9" stroke-dasharray="3 7"/>'),
    },

    // ---- 23. 万物を見通す目 ----
    allSeeingEye: {
      name: "万物を見通す目",
      note: "三角形の中の目。ミステリアスさが一気に増す一枚看板。",
      size: "58% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g stroke="' + INK_FAINT + '" stroke-width="1">' +
        ring(100, 108, 96, 16, function (x, y) {
          return '<line x1="' + (100 + (x - 100) * 0.72).toFixed(1) + '" y1="' + (108 + (y - 108) * 0.72).toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
        }) +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.6">' +
        '<polygon points="' + polygonPoints(100, 108, 76, 3, 0) + '" stroke-linejoin="round"/>' +
        '<path d="M60,112 Q100,80 140,112 Q100,144 60,112 Z"/>' +
        "</g>" +
        '<circle cx="100" cy="112" r="14" fill="none" stroke="' + INK_SOFT + '" stroke-width="1.4"/>' +
        '<circle cx="100" cy="112" r="5.5" fill="' + INK + '"/>'),
    },

    // ---- 24. 交差する杖 ----
    wands: {
      name: "交差する杖",
      note: "魔法使いの得物。紋章のように構えが決まる。",
      size: "62% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="2.6" stroke-linecap="round">' +
        '<line x1="36" y1="168" x2="150" y2="54"/>' +
        '<line x1="164" y1="168" x2="50" y2="54"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK + '" stroke-width="1.4">' +
        '<line x1="52" y1="152" x2="64" y2="164"/><line x1="60" y1="144" x2="72" y2="156"/>' +
        '<line x1="148" y1="152" x2="136" y2="164"/><line x1="140" y1="144" x2="128" y2="156"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.3">' +
        '<path d="M150,54 l6,-14 l6,14 l14,6 l-14,6 l-6,14 l-6,-14 l-14,-6 Z"/>' +
        '<path d="M50,54 l4,-10 l4,10 l10,4 l-10,4 l-4,10 l-4,-10 l-10,-4 Z"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '">' +
        '<circle cx="100" cy="30" r="2.4"/><circle cx="176" cy="104" r="2"/><circle cx="26" cy="104" r="2"/>' +
        "</g>"),
    },

    // ---- 25. 魔導書 ----
    grimoire: {
      name: "魔導書",
      note: "開いた本から魔法陣が浮かぶ図。「Xの研究ノート」感が出る。",
      size: "72% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 180",
        '<g fill="none" stroke="' + INK_FAINT + '" stroke-width="1">' +
        '<circle cx="100" cy="48" r="34"/><circle cx="100" cy="48" r="26"/>' +
        '<polygon points="' + polygonPoints(100, 48, 26, 3, 0) + '"/>' +
        '<polygon points="' + polygonPoints(100, 48, 26, 3, Math.PI) + '"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.5">' +
        '<path d="M100,120 C74,106 44,104 18,110 L18,158 C44,152 74,154 100,168 Z"/>' +
        '<path d="M100,120 C126,106 156,104 182,110 L182,158 C156,152 126,154 100,168 Z"/>' +
        '<line x1="100" y1="120" x2="100" y2="168"/>' +
        "</g>" +
        '<g stroke="' + INK_FAINT + '" stroke-width="0.9">' +
        '<line x1="30" y1="122" x2="86" y2="132"/><line x1="30" y1="134" x2="86" y2="144"/>' +
        '<line x1="30" y1="146" x2="72" y2="153"/>' +
        '<line x1="114" y1="132" x2="170" y2="122"/><line x1="114" y1="144" x2="170" y2="134"/>' +
        '<line x1="114" y1="153" x2="156" y2="146"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '">' +
        '<circle cx="100" cy="92" r="2"/><circle cx="88" cy="102" r="1.5"/><circle cx="112" cy="102" r="1.5"/>' +
        "</g>"),
    },

    // ---- 26. 水晶玉 ----
    crystalBall: {
      name: "水晶玉",
      note: "占いの水晶。中に星を仕込めるので謎の仕掛けにも使える。",
      size: "48% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 160 200",
        '<circle cx="80" cy="84" r="58" fill="none" stroke="' + INK_SOFT + '" stroke-width="1.6"/>' +
        '<path d="M44,50 C34,60 30,74 34,88" fill="none" stroke="' + INK_FAINT + '" stroke-width="2.6" stroke-linecap="round"/>' +
        '<g fill="none" stroke="' + INK_FAINT + '" stroke-width="0.9">' +
        '<path d="M40,104 C58,92 74,104 92,92 C106,82 118,90 124,100"/>' +
        '<path d="M46,118 C64,108 80,118 98,108"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '">' +
        '<circle cx="66" cy="70" r="2.2"/><circle cx="96" cy="60" r="1.7"/><circle cx="104" cy="82" r="1.5"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.5">' +
        '<path d="M46,132 C58,146 102,146 114,132"/>' +
        '<path d="M52,142 L44,176"/><path d="M108,142 L116,176"/>' +
        '<rect x="34" y="176" width="92" height="10" rx="4"/>' +
        "</g>"),
    },

    // ---- 27. 錬金の蒸留器 ----
    alembic: {
      name: "錬金の蒸留器",
      note: "フラスコと炎。理科室の謎ともつながる錬金術らしい一枚。",
      size: "64% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 180",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.5">' +
        '<circle cx="58" cy="86" r="34"/>' +
        '<path d="M46,54 L46,32 L70,32 L70,54"/>' +
        '<path d="M86,72 C120,64 138,80 140,102"/>' +
        '<path d="M92,84 C122,78 132,92 132,104"/>' +
        '<path d="M120,104 L152,104 L146,146 C144,156 128,156 126,146 Z"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '" stroke="none">' +
        '<path d="M129,132 L149,132 L146,146 C144,156 132,156 130,146 Z"/>' +
        '<circle cx="50" cy="92" r="3"/><circle cx="64" cy="80" r="2.2"/><circle cx="70" cy="96" r="2.6"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.3">' +
        '<path d="M44,150 C44,138 52,134 52,124 C58,132 54,140 58,146 C64,140 62,130 68,126 C72,138 74,142 74,150" />' +
        '<line x1="34" y1="152" x2="84" y2="152"/>' +
        "</g>"),
    },

    // ---- 28. 大釜 ----
    cauldron: {
      name: "大釜",
      note: "煮えたぎる魔女の釜。泡と炎でにぎやかにできる。",
      size: "58% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 180",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.6">' +
        '<ellipse cx="100" cy="84" rx="60" ry="14"/>' +
        '<path d="M40,84 C40,132 62,150 100,150 C138,150 160,132 160,84"/>' +
        '<path d="M32,84 L168,84"/>' +
        '<path d="M70,150 L60,168"/><path d="M130,150 L140,168"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_FAINT + '" stroke-width="1.1">' +
        '<circle cx="82" cy="60" r="7"/><circle cx="106" cy="46" r="5"/><circle cx="124" cy="62" r="4"/>' +
        '<circle cx="94" cy="30" r="3.4"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.3">' +
        '<path d="M64,168 C64,158 72,154 72,146 C78,153 74,160 78,165"/>' +
        '<path d="M122,165 C126,160 122,153 128,146 C128,154 136,158 136,168"/>' +
        "</g>" +
        '<ellipse cx="100" cy="86" rx="52" ry="9" fill="' + INK_FAINT + '" stroke="none"/>'),
    },

    // ---- 29. 召喚陣 ----
    summonCircle: {
      name: "召喚陣",
      note: "六芒星＋蝋燭。magicCircleより儀式感・禍々しさが強い版。",
      size: "76% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.3">' +
        '<circle cx="100" cy="100" r="94"/><circle cx="100" cy="100" r="72"/>' +
        '<polygon points="' + polygonPoints(100, 100, 72, 3, 0) + '"/>' +
        '<polygon points="' + polygonPoints(100, 100, 72, 3, Math.PI) + '"/>' +
        '<circle cx="100" cy="100" r="36"/>' +
        '<polygon points="' + starPath(100, 100, 36, 5, 2) + '" stroke="' + INK_FAINT + '"/>' +
        "</g>" +
        // 頂点の蝋燭
        '<g fill="none" stroke="' + INK + '" stroke-width="1.2">' +
        ring(100, 100, 83, 6, function (x, y) {
          return '<rect x="' + (x - 4).toFixed(1) + '" y="' + (y - 3).toFixed(1) + '" width="8" height="12" rx="2"/>' +
            '<path d="M' + x.toFixed(1) + ',' + (y - 4).toFixed(1) + ' C' + (x - 4).toFixed(1) + ',' + (y - 10).toFixed(1) + ' ' + (x + 4).toFixed(1) + ',' + (y - 12).toFixed(1) + ' ' + x.toFixed(1) + ',' + (y - 18).toFixed(1) + '"/>';
        }) +
        "</g>" +
        '<g fill="' + INK_FAINT + '" font-family="serif" font-size="10" text-anchor="middle">' +
        ring(100, 100, 55, 6, function (x, y, rot, i) {
          return '<text x="' + x.toFixed(1) + '" y="' + (y + 3).toFixed(1) + '">' + RUNES[i * 4 % RUNES.length] + "</text>";
        }) +
        "</g>"),
    },

    // ---- 30. 封印の鎖 ----
    sealChains: {
      name: "封印の鎖",
      note: "錠前と交差する鎖。まさに「封印」。鍵の透かしと相性◎。",
      size: "70% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.5">' +
        (function () {
          var o = "";
          for (var i = 0; i < 9; i++) {
            var t = i / 8;
            var x = 12 + t * 176, y = 30 + t * 140;
            o += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="11" ry="6.5" transform="rotate(38 ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
          }
          for (var j = 0; j < 9; j++) {
            var u = j / 8;
            var x2 = 188 - u * 176, y2 = 30 + u * 140;
            o += '<ellipse cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" rx="11" ry="6.5" transform="rotate(-38 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ')"/>';
          }
          return o;
        })() +
        "</g>" +
        '<g fill="rgba(236,223,192,0.55)" stroke="' + INK + '" stroke-width="1.8">' +
        '<path d="M82,92 L82,78 A18,18 0 0,1 118,78 L118,92" fill="none"/>' +
        '<rect x="68" y="92" width="64" height="50" rx="8"/>' +
        "</g>" +
        '<g fill="' + INK + '">' +
        '<circle cx="100" cy="112" r="6"/>' +
        '<path d="M97,116 L103,116 L105,132 L95,132 Z"/>' +
        "</g>"),
    },

    // ---- 31. 燭台 ----
    candelabra: {
      name: "燭台",
      note: "三叉の蝋燭立て。夜の書斎感が出て、上下の余白にも収まる。",
      size: "56% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 180",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.6">' +
        '<path d="M100,150 L100,86"/>' +
        '<path d="M100,104 C82,104 62,96 54,80"/>' +
        '<path d="M100,104 C118,104 138,96 146,80"/>' +
        '<path d="M54,80 L54,64"/><path d="M146,80 L146,64"/>' +
        '<rect x="44" y="52" width="20" height="12" rx="3"/>' +
        '<rect x="136" y="52" width="20" height="12" rx="3"/>' +
        '<rect x="90" y="60" width="20" height="12" rx="3"/>' +
        '<path d="M100,86 L100,72"/>' +
        '<path d="M78,150 C78,158 70,160 70,166 L130,166 C130,160 122,158 122,150 Z"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.5">' +
        '<rect x="48" y="34" width="12" height="18" rx="3"/>' +
        '<rect x="140" y="34" width="12" height="18" rx="3"/>' +
        '<rect x="94" y="42" width="12" height="18" rx="3"/>' +
        "</g>" +
        '<g fill="' + INK_FAINT + '" stroke="' + INK_SOFT + '" stroke-width="1.1">' +
        '<path d="M54,32 C48,24 58,20 54,10 C62,18 62,26 54,32 Z"/>' +
        '<path d="M146,32 C140,24 150,20 146,10 C154,18 154,26 146,32 Z"/>' +
        '<path d="M100,40 C94,32 104,28 100,18 C108,26 108,34 100,40 Z"/>' +
        "</g>"),
    },

    // ---- 32. 天球儀 ----
    orbits: {
      name: "天球儀",
      note: "惑星の軌道。傾いた楕円が重なる図で知的な魔術師っぽさ。",
      size: "72% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.1">' +
        '<ellipse cx="100" cy="100" rx="92" ry="34" transform="rotate(-20 100 100)"/>' +
        '<ellipse cx="100" cy="100" rx="74" ry="28" transform="rotate(28 100 100)"/>' +
        '<ellipse cx="100" cy="100" rx="56" ry="22" transform="rotate(-64 100 100)"/>' +
        '<ellipse cx="100" cy="100" rx="38" ry="15" transform="rotate(72 100 100)"/>' +
        "</g>" +
        '<circle cx="100" cy="100" r="12" fill="none" stroke="' + INK + '" stroke-width="1.4"/>' +
        '<g stroke="' + INK_SOFT + '" stroke-width="1">' +
        ring(100, 100, 20, 8, function (x, y) {
          return '<line x1="' + (100 + (x - 100) * 0.7).toFixed(1) + '" y1="' + (100 + (y - 100) * 0.7).toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
        }) +
        "</g>" +
        '<g fill="' + INK + '">' +
        '<circle cx="176" cy="72" r="4.4"/><circle cx="46" cy="132" r="3.6"/>' +
        '<circle cx="132" cy="146" r="3"/><circle cx="70" cy="66" r="2.6"/>' +
        "</g>"),
    },

    // ---- 33. 魔術記号（シジル） ----
    sigilMark: {
      name: "魔術記号",
      note: "意味を持たせられる抽象記号。オリジナルの紋章として使える。",
      size: "54% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 200 200",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M100,20 L100,150"/>' +
        '<path d="M62,58 L138,58"/>' +
        '<path d="M100,150 L58,112"/>' +
        '<path d="M100,150 L142,112"/>' +
        '<path d="M62,58 L44,92"/>' +
        '<path d="M138,58 L156,92"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.4">' +
        '<circle cx="100" cy="20" r="8"/>' +
        '<circle cx="44" cy="92" r="7"/>' +
        '<circle cx="156" cy="92" r="7"/>' +
        '<circle cx="100" cy="88" r="22"/>' +
        "</g>" +
        '<g fill="' + INK + '">' +
        '<circle cx="58" cy="112" r="3.6"/><circle cx="142" cy="112" r="3.6"/>' +
        '<circle cx="100" cy="150" r="4.6"/>' +
        "</g>" +
        '<circle cx="100" cy="100" r="86" fill="none" stroke="' + INK_FAINT + '" stroke-width="0.9" stroke-dasharray="4 8"/>'),
    },

    // ---- 34. 羽根ペンとインク壺 ----
    quill: {
      name: "羽根ペン",
      note: "Xが手紙を書いた道具そのもの。署名まわりに置くと効く。",
      size: "44% auto",
      position: "center",
      repeat: "no-repeat",
      svg: svg("0 0 180 180",
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.5">' +
        '<path d="M40,150 C60,96 96,50 148,20 C142,74 116,120 62,144 Z"/>' +
        '<path d="M148,20 C120,60 92,102 40,150"/>' +
        "</g>" +
        '<g stroke="' + INK_FAINT + '" stroke-width="0.9">' +
        '<path d="M126,44 L104,44"/><path d="M136,60 L96,64"/>' +
        '<path d="M118,80 L82,88"/><path d="M104,100 L70,112"/>' +
        '<path d="M86,120 L58,132"/>' +
        "</g>" +
        '<g fill="none" stroke="' + INK_SOFT + '" stroke-width="1.5">' +
        '<path d="M26,146 C26,140 42,138 42,146 L42,164 C42,170 26,170 26,164 Z"/>' +
        '<ellipse cx="34" cy="146" rx="8" ry="3.4"/>' +
        "</g>" +
        '<ellipse cx="34" cy="152" rx="7" ry="2.6" fill="' + INK_FAINT + '" stroke="none"/>'),
    },
  };

  // ========================================
  // 組み合わせプリセット
  //
  // モチーフごとに大きさ・位置を上書きできる。書式は
  //   "モチーフID|大きさ|位置"
  // 例: "quill|22% auto|8% 7%" → 羽根ペンを22%の大きさで左上に置く
  // 並び順は「手前 → 奥」。
  // ========================================
  var PRESETS = {
    // Xの手紙・4点セット（魔法陣を背に、鍵・魔導書・羽根ペンを配置）
    xLetter: [
      "quill|26% auto|6% 5%",
      "grimoire|36% auto|6% 88%",
      "keyWatermark|56% auto|center 48%",
      "magicCircle|80% auto|center 48%",
    ],

    // ------------------------------------------------------------------
    // パンフレット合わせ用（謎のギミック）
    //
    // 4つの図形を手紙の右端に、それぞれ「左半分だけ」見えるように置く。
    // 図形の中心はちょうど紙の右端の線上にくるので、
    // 同じ図形の「右半分」を左端に印刷したパンフレットを
    // 画面のこの端に突き合わせると、4つの図形が同時に完成する。
    //
    // ▼ パンフレット側を作るときの寸法（紙の左端からの位置）
    //     魔法陣   直径 34mm ／ 手紙の高さの 14% の位置
    //     鍵       幅  30mm ／ 同 38%
    //     魔導書   幅  32mm ／ 同 62%
    //     羽根ペン 幅  26mm ／ 同 86%
    //   ※ 上下位置は手紙の高さに対する割合なので、実際に使う手紙で
    //      現物合わせをして最終決定すること。
    // ------------------------------------------------------------------
    pamphletEdge: [
      "magicCircle|34mm auto|calc(100% + 17mm) 14%",
      "keyWatermark|30mm auto|calc(100% + 15mm) 38%",
      "grimoire|32mm auto|calc(100% + 16mm) 62%",
      "quill|26mm auto|calc(100% + 13mm) 86%",
    ],
  };

  // 既定の組み合わせ（手前 → 奥）
  var DEFAULT_DECOR = PRESETS.pamphletEdge;

  function toDataUri(svgText) {
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText) + '")';
  }

  // "モチーフID|大きさ|位置|繰り返し" の記法をばらす
  function parseItem(raw) {
    if (raw && typeof raw === "object") return raw;
    var parts = String(raw).split("|");
    var item = { id: parts[0].trim() };
    if (parts[1] && parts[1].trim()) item.size = parts[1].trim();
    if (parts[2] && parts[2].trim()) item.position = parts[2].trim();
    if (parts[3] && parts[3].trim()) item.repeat = parts[3].trim();
    return item;
  }

  // モチーフ1つを background の各プロパティに展開する
  // ov で大きさ・位置・繰り返しを個別に上書きできる
  function expand(motif, ov) {
    ov = ov || {};
    var n = motif.layers || 1;
    var images = [];
    var sizes = [];
    var positions = [];
    var repeats = [];
    for (var i = 0; i < n; i++) {
      images.push(toDataUri(motif.svg));
      sizes.push(ov.size || (motif.sizes ? motif.sizes[i] : motif.size));
      positions.push(ov.position || (motif.positions ? motif.positions[i] : motif.position));
      repeats.push(ov.repeat || motif.repeat);
    }
    return { images: images, sizes: sizes, positions: positions, repeats: repeats };
  }

  // 要素に装飾を適用する。
  // 既存の背景（羊皮紙のグラデーション）は computed style から読み取って
  // そのまま後ろに残すので、CSS側の定義を二重管理しなくてよい。
  function apply(el, names) {
    if (!el) return;
    if (el.getAttribute("data-decor-applied") === "1") return;

    var list = names;
    if (!list) {
      var attr = el.getAttribute("data-decor");
      if (attr === "none") { el.setAttribute("data-decor-applied", "1"); return; }
      if (attr && attr.indexOf("preset:") === 0) {
        list = PRESETS[attr.slice(7).trim()] || DEFAULT_DECOR;
      } else {
        list = attr ? attr.split(",") : DEFAULT_DECOR;
      }
    }

    var images = [];
    var sizes = [];
    var positions = [];
    var repeats = [];
    var blends = [];

    list.forEach(function (raw) {
      var item = parseItem(raw);
      var motif = MOTIFS[item.id];
      if (!motif) return;
      var e = expand(motif, item);
      images = images.concat(e.images);
      sizes = sizes.concat(e.sizes);
      positions = positions.concat(e.positions);
      repeats = repeats.concat(e.repeats);
      e.images.forEach(function () { blends.push("multiply"); });
    });

    if (!images.length) { el.setAttribute("data-decor-applied", "1"); return; }

    var cs = window.getComputedStyle(el);
    var baseImage = cs.backgroundImage;
    if (baseImage && baseImage !== "none") {
      images.push(baseImage);
      sizes.push(cs.backgroundSize || "auto");
      positions.push(cs.backgroundPosition || "0% 0%");
      repeats.push(cs.backgroundRepeat || "repeat");
      blends.push("normal");
    }

    el.style.backgroundImage = images.join(", ");
    el.style.backgroundSize = sizes.join(", ");
    el.style.backgroundPosition = positions.join(", ");
    el.style.backgroundRepeat = repeats.join(", ");
    el.style.backgroundBlendMode = blends.join(", ");
    el.setAttribute("data-decor-applied", "1");
  }

  function applyAll(selector) {
    var els = document.querySelectorAll(selector || ".letter, .letter-content");
    Array.prototype.forEach.call(els, function (el) { apply(el); });
  }

  global.LetterDecor = {
    MOTIFS: MOTIFS,
    PRESETS: PRESETS,
    DEFAULT_DECOR: DEFAULT_DECOR,
    apply: apply,
    applyAll: applyAll,
    toDataUri: toDataUri,
    expand: expand,
  };

  // 手紙の要素が最初から置いてあるページでは自動で適用する
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { applyAll(); });
  } else {
    applyAll();
  }
})(window);
