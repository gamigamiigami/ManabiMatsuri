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
// ▼ 狙い（世界観）
//   「かわいい鈴の音」ではなく、「手紙を開いた瞬間、学校全体に
//   壮大な魔法がかかり、参加者が魔法の世界に招き入れられる」という
//   没入感を音だけで作る。約6秒、ふわっと長く伸びる構成にしてある。
//
// ▼ 音の構成（すべて合成音。約6秒）
//   1. 低い持続音（ドローン）がゆっくり立ち上がる＝学校全体を包む気配
//   2. 風のうねり（フィルターをかけたノイズ、低くこもった音から始まる）
//   3. 深く低い鐘（銅鑼に近い、複数の非整数倍音を重ねたベル）が一度、
//      重く鳴る＝封印の起動
//   4. あやしい旋律（長調ではなく全音音階＝調性のはっきりしない
//      浮遊した並び）がゆっくり立ちのぼる
//   5. まばらな煌めき（きらきら粒。数を減らし間隔を広げ、星のように）
//   全体を簡易リバーブ（フィードバック付きディレイ）に薄く通し、
//   広い空間で鳴っているような奥行きを出している。
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

  // ごく簡易なリバーブ（IRファイルなしで作る）。
  // ディレイ×3本をフィードバックさせ、ループ内にローパスをかけて
  // こもらせることで、残響っぽい広がりを作る。
  function makeReverbSend(c) {
    var input = c.createGain();
    var wet = c.createGain();
    wet.gain.value = 0.55;
    [0.17, 0.29, 0.41].forEach(function (time, i) {
      var delay = c.createDelay(1.0);
      delay.delayTime.value = time;
      var feedback = c.createGain();
      feedback.gain.value = 0.42 - i * 0.05;
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200 - i * 400;
      input.connect(delay);
      delay.connect(lp);
      lp.connect(feedback);
      feedback.connect(delay);
      lp.connect(wet);
    });
    input.connect(wet); // ディレイ前のドライ成分もうっすら混ぜる
    wet.connect(c.destination);
    return input;
  }

  // 深い鐘（銅鑼寄り）。整数比からわずかにズラした倍音を重ねて、
  // 澄んだベルではなく、少しくすんだ・重い響きにする。
  function deepGong(c, t0, dry, wet, freq, dur, gain) {
    var partials = [1, 2.01, 2.76, 3.94, 5.4];
    var mixes = [1.0, 0.5, 0.32, 0.2, 0.12];
    partials.forEach(function (ratio, i) {
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * ratio, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain * mixes[i], t0 + 0.08 + i * 0.02);
      g.gain.exponentialRampToValueAtTime(0.0006, t0 + dur * (1 - i * 0.08));
      osc.connect(g);
      g.connect(dry);
      g.connect(wet);
      osc.start(t0);
      osc.stop(t0 + dur + 0.2);
    });
  }

  // あやしい旋律の1音。sine + デチューンtriangleで、余韻の長いベル。
  function bell(c, t0, dry, wet, freq, dur, gain) {
    [
      { type: "sine", detune: 0, mix: 1.0 },
      { type: "triangle", detune: -7, mix: 0.35 },
    ].forEach(function (layer) {
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = layer.type;
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime(layer.detune, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain * layer.mix, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0007, t0 + dur);
      osc.connect(g);
      g.connect(dry);
      g.connect(wet);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    });
  }

  // 低いドローン（学校全体を包む気配）。2音を五度で重ね、
  // ゆっくりフェードインしてゆっくりフェードアウトする。
  function drone(c, t0, dry, wet, dur) {
    [55, 82.5].forEach(function (freq, i) {
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.05 - i * 0.015, t0 + dur * 0.4);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(g);
      g.connect(dry);
      g.connect(wet);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    });
  }

  // 風のうねり。低くこもった帯域からゆっくり開けていく、長めのノイズ。
  function windSwell(c, t0, dry, wet, dur) {
    var bufSize = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    var src = c.createBufferSource();
    src.buffer = buf;
    var filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(0.7, t0);
    filter.frequency.setValueAtTime(180, t0);
    filter.frequency.exponentialRampToValueAtTime(1600, t0 + dur * 0.75);
    filter.frequency.exponentialRampToValueAtTime(500, t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.06, t0 + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.02, t0 + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t0 + dur);

    src.connect(filter).connect(g);
    g.connect(dry);
    g.connect(wet);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  // 星のようにまばらな煌めき。数を絞り、間隔を広くとる。
  function sparkle(c, t0, dry, wet, gain) {
    var freq = 1400 + Math.random() * 1800;
    var osc = c.createOscillator();
    var g = c.createGain();
    var pan = c.createStereoPanner ? c.createStereoPanner() : null;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, t0 + 0.1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.9);
    var node = osc;
    if (pan) {
      pan.pan.setValueAtTime(Math.random() * 2 - 1, t0);
      osc.connect(g).connect(pan);
      pan.connect(dry);
      pan.connect(wet);
    } else {
      osc.connect(g);
      g.connect(dry);
      g.connect(wet);
    }
    osc.start(t0);
    osc.stop(t0 + 1.0);
  }

  function play() {
    var c = getCtx();
    if (!c) return;
    var t0 = c.currentTime + 0.02;

    var dry = c.createGain();
    dry.gain.value = 1;
    dry.connect(c.destination);
    var wet = makeReverbSend(c);

    // 1. 低いドローンと風のうねりが、同時にゆっくり立ち上がる
    drone(c, t0, dry, wet, 5.6);
    windSwell(c, t0, dry, wet, 2.6);

    // 2. 少し間を置いて、深く重い鐘が一度鳴る＝封印が起動する瞬間
    deepGong(c, t0 + 0.55, dry, wet, 98, 4.4, 0.16);

    // 3. あやしい旋律（全音音階＝調性感の薄い、浮遊した並び）が
    //    ゆっくり立ちのぼる
    var notes = [196.0, 220.0, 246.94, 277.18, 311.13, 370.0];
    notes.forEach(function (f, i) {
      bell(c, t0 + 1.1 + i * 0.34, dry, wet, f, 2.3, 0.075);
    });

    // 4. まばらな星の煌めき。手紙が開いたあとも余韻として残す
    for (var i = 0; i < 10; i++) {
      sparkle(c, t0 + 1.4 + Math.random() * 3.6, dry, wet, 0.045 + Math.random() * 0.025);
    }
  }

  global.MagicChime = { play: play };
})(window);
