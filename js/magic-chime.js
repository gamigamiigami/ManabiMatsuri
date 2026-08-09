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
//   「かわいい鈴の音」ではなく、「手紙を開いた瞬間、ふわーっと
//   魔法にかけられ、そのまま魔法の世界へ連れて行かれる」という
//   没入感を音だけで作る。約7秒、切れ目なく伸び続ける構成。
//
// ▼ 音の構成（すべて合成音。約7秒）
//   1. 低い持続音（ドローン）がゆっくり立ち上がる＝空気が変わる気配
//   2. ふわーっと立ちのぼる風（ピンクノイズのローパスをゆっくり開く）
//   3. 深く低い鐘（銅鑼に近い、非整数倍音を重ねたもの）が一度だけ重く鳴る
//      ＝魔法がかかる瞬間
//   4. 浮遊した和音（全音音階＝調性のはっきりしない並び）が、
//      ひと粒ずつではなく重なったまま「ゆっくり咲く」ように膨らむ
//   5. ゆっくり上へ滑っていく音＝どこかへ連れて行かれる感じ
//   全体を簡易リバーブ（フィードバック付きディレイ）に通し、
//   広い空間で鳴っているような奥行きを出している。
//
//   ※ かつて入れていた「まばらな煌めき（sparkle）」は、高い音が
//     短く跳ねるせいで鳥のさえずりのように聞こえてしまったため廃止。
//     単発の粒を鳴らさず、すべて「伸びる音」で構成すること。
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

  // 浮遊した和音の1音。あえて立ち上がりを遅くして（dur の35%かけて
  // 膨らむ）、弾いた音ではなく「ふくらむ音」にする。
  // 微妙にずらした2つのsineが干渉してゆっくり揺れ、生きた響きになる。
  function pad(c, t0, dry, wet, freq, dur, gain) {
    [
      { type: "sine", detune: 0, mix: 1.0 },
      { type: "sine", detune: 7, mix: 0.7 },
      { type: "triangle", detune: -6, mix: 0.26 },
    ].forEach(function (layer) {
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = layer.type;
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime(layer.detune, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain * layer.mix, t0 + dur * 0.35);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(g);
      g.connect(dry);
      g.connect(wet);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    });
  }

  // ゆっくり上へ滑っていく音。「連れて行かれる」感じを作る。
  function glide(c, t0, dry, wet, fromFreq, toFreq, dur, gain) {
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(fromFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur * 0.85);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g);
    g.connect(dry);
    g.connect(wet);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
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

  // ふわーっと立ちのぼる風。
  // 白色ノイズだと「シャーッ」と耳につくので、ピンクノイズ寄りに
  // 整えてから、ローパスをゆっくり開いて（低い→抜ける→また沈む）
  // 息を吸って吐くような大きなうねりを作る。
  function riser(c, t0, dry, wet, dur) {
    var bufSize = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var data = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < bufSize; i++) {
      var w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    }

    var src = c.createBufferSource();
    src.buffer = buf;
    var lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.setValueAtTime(1.1, t0);
    lp.frequency.setValueAtTime(220, t0);
    lp.frequency.exponentialRampToValueAtTime(4200, t0 + dur * 0.72);
    lp.frequency.exponentialRampToValueAtTime(700, t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.085, t0 + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t0 + dur);

    src.connect(lp).connect(g);
    g.connect(dry);
    g.connect(wet);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  function play() {
    var c = getCtx();
    if (!c) return;
    var t0 = c.currentTime + 0.02;

    var dry = c.createGain();
    dry.gain.value = 1;
    dry.connect(c.destination);
    var wet = makeReverbSend(c);

    // 1. 低いドローン＝空気が変わる気配。最後まで敷き続ける
    drone(c, t0, dry, wet, 7.0);

    // 2. ふわーーーっと立ちのぼる風
    riser(c, t0 + 0.1, dry, wet, 3.6);

    // 3. 深く重い響きが一度だけ＝魔法がかかる瞬間
    deepGong(c, t0 + 0.7, dry, wet, 87, 5.0, 0.13);

    // 4. 浮遊した和音（全音音階）が、重なったままゆっくり咲く。
    //    ずらし方を小さくして、旋律ではなく「ひとかたまりの響き」にする
    var chord = [196.0, 246.94, 311.13, 392.0];
    chord.forEach(function (f, i) {
      pad(c, t0 + 1.0 + i * 0.26, dry, wet, f, 4.8, 0.055);
    });

    // 5. ゆっくり上へ滑っていく音＝魔法の世界へ連れて行かれる
    glide(c, t0 + 1.5, dry, wet, 261.63, 523.25, 4.2, 0.038);
  }

  global.MagicChime = { play: play };
})(window);
