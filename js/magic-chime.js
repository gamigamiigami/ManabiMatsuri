// ========================================
// 「魔法の手紙が開く音」を合成して鳴らす
// ========================================
// 音声ファイルを一切持たず、Web Audio API だけで音を組み立てている。
// 静的サイト（GitHub Pages）に音声アセットを追加・ホストする必要がなく、
// ライセンスも気にしなくてよい。
//
// ▼ 使い方
//   <script src="js/magic-chime.js"></script>
//   ...
//   MagicChime.play();
//
//   ブラウザの自動再生ポリシー上、音はユーザー操作（クリックなど）の
//   ハンドラの中でしか鳴らせない。ページ読み込み時に自動再生しようとしても
//   鳴らないので、必ず封蝋クリックなどのイベント内で呼ぶこと。
//
// ▼ 音の構成（すべて合成音）
//   1. シューッと立ち上がる風の膨らみ（フィルターをかけたノイズ）
//   2. のぼっていくベルの和音5音（リディア風＝魔法陣が開くイメージ）
//   3. きらきら散る粒（ランダムな高音を14個、左右にばらまく）
(function (global) {
  "use strict";

  var ctx = null;
  function getCtx() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    return ctx;
  }

  // ベル1音。sine + わずかにデチューンした triangle を重ねて、きらっとした倍音を作る。
  function bell(c, t0, freq, dur, gain) {
    [
      { type: "sine", detune: 0, mix: 1.0 },
      { type: "triangle", detune: 6, mix: 0.4 },
    ].forEach(function (layer) {
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = layer.type;
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime(layer.detune, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain * layer.mix, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
      osc.connect(g).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });
  }

  // きらっと光る短いつぶ（sparkle）。ランダムな高音を左右にばらまく。
  function sparkle(c, t0, gain) {
    var freq = 1800 + Math.random() * 2400;
    var osc = c.createOscillator();
    var g = c.createGain();
    var pan = c.createStereoPanner ? c.createStereoPanner() : null;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.4, t0 + 0.05);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.12);
    if (pan) {
      pan.pan.setValueAtTime(Math.random() * 2 - 1, t0);
      osc.connect(g).connect(pan).connect(c.destination);
    } else {
      osc.connect(g).connect(c.destination);
    }
    osc.start(t0);
    osc.stop(t0 + 0.15);
  }

  // シューッと魔法が開く風のような、フィルターをかけたノイズの膨らみ。
  function shimmerSwell(c, t0, dur) {
    var bufSize = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    var src = c.createBufferSource();
    src.buffer = buf;
    var filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(0.9, t0);
    filter.frequency.setValueAtTime(500, t0);
    filter.frequency.exponentialRampToValueAtTime(4200, t0 + dur * 0.85);
    var g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, t0 + dur);

    src.connect(filter).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function play() {
    var c = getCtx();
    if (!c) return;
    var t0 = c.currentTime + 0.02;

    shimmerSwell(c, t0, 1.0);

    // のぼっていく和音（C5 E5 G5 B5 D6＝リディア風）
    var notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    notes.forEach(function (f, i) {
      bell(c, t0 + i * 0.09, f, 1.1, 0.09);
    });

    for (var i = 0; i < 14; i++) {
      sparkle(c, t0 + 0.15 + Math.random() * 0.9, 0.05 + Math.random() * 0.03);
    }
  }

  global.MagicChime = { play: play };
})(window);
