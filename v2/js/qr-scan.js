// QRコード読み取り機
//
// OSのカメラアプリでQRを読み取ると、読み取るたびに新しいタブが増えていく
// （iOS/Androidとも、カメラアプリからのリンクは新規タブとして開く挙動のため、
// サイト側からは変えられない）。このモジュールはサイトの中にカメラを持たせることで、
// 同じタブのまま次々と謎を開けるようにするためのもの。

/**
 * カメラ読み取りセッションを開始する。
 *
 * @param {Object} options
 * @param {HTMLVideoElement} options.video - ライブ映像を表示するビデオ要素
 * @param {HTMLCanvasElement} options.canvas - フレーム解析用キャンバス（hidden でOK）
 * @param {Function} options.onDecode - QRデコード成功時、読み取ったテキストで呼び出す
 * @param {Function} options.onStatus - 状態メッセージ表示用、テキストと kind('ok'|'err') で呼び出す
 * @param {Function} options.onDenied - カメラ許可がない・非対応のとき呼び出す
 * @returns {Object} {start(), stop()} メソッド
 */
export function createScanner({ video, canvas, onDecode, onStatus, onDenied }) {
  let stream = null;
  let rafId = null;
  let found = false; // 一度見つけたら、遷移するまで二重に反応しない

  const ctx2d = canvas.getContext("2d", { willReadFrequently: true });

  function setStatus(text, kind) {
    if (onStatus) onStatus(text, kind);
  }

  function stopCamera() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      stream.getTracks().forEach(function (t) {
        t.stop();
      });
      stream = null;
    }
  }

  // 読み取り成功。
  function onDecoded(text) {
    if (found) return;
    found = true;
    stopCamera();
    setStatus("印を讀み取った。今ひらく…", "ok");

    if (onDecode) onDecode(text);
  }

  function tick() {
    if (found) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
      let code = null;
      try {
        // jsQRは <script src="js/vendor/jsQR.min.js"> でグローバル登録される。
        // 存在しなければ gracefully degrade。
        code = window.jsQR
          ? window.jsQR(img.data, img.width, img.height, {
              inversionAttempts: "dontInvert",
            })
          : null;
      } catch (e) {
        code = null;
      }
      if (code && code.data) {
        onDecoded(code.data);
        return;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("この端末ではカメラが使へぬ。下の番号から進め。", "err");
      if (onDenied) onDenied();
      return;
    }
    setStatus("カメラを起こしてゐる…");
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then(function (s) {
        stream = s;
        video.srcObject = s;
        setStatus("印を枠の中に入れよ");
        rafId = requestAnimationFrame(tick);
      })
      .catch(function () {
        setStatus("カメラを使ふ許しが無い。下の番号から進め。", "err");
        if (onDenied) onDenied();
      });
  }

  // 見えなくなったら停止、見えたら再開（タブ切り替え時など）
  function onPageHide() {
    stopCamera();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stopCamera();
    } else if (!found) {
      startCamera();
    }
  }

  return {
    start() {
      found = false;
      window.addEventListener("pagehide", onPageHide);
      document.addEventListener("visibilitychange", onVisibilityChange);
      startCamera();
    },
    stop() {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopCamera();
    },
  };
}

/**
 * QRテキストを分類する。
 * 自サイトのURLまたは relative URL ?query の形なら、その内容を返す。
 * 見慣れないものなら 'unknown' を返す。
 *
 * @param {string} text - QR内のテキスト
 * @returns {Object} {kind:'puzzle', q, room} | {kind:'pid', pid} | {kind:'unknown'}
 */
export function classifyQr(text) {
  // 自サイトのURL なら origin を取る。同一オリジンのフルURLでもいいし、
  // 相対 URL でもいい。見慣れないホストなら 'unknown'。
  const isOwnSite =
    text.indexOf(location.origin) === 0 ||
    /^[a-zA-Z0-9_.\-]+\.html([?#].*)?$/.test(text);

  if (!isOwnSite) {
    return { kind: "unknown" };
  }

  // URL から ?query の部分を抽出
  let query = "";
  const hashIdx = text.indexOf("#");
  const qIdx = text.indexOf("?");

  if (qIdx !== -1) {
    const end = hashIdx !== -1 ? hashIdx : text.length;
    query = text.substring(qIdx + 1, end);
  }

  // ?q=...&room=... なら puzzle
  const qMatch = /[?&]q=([^&#]+)/.exec(text);
  const roomMatch = /[?&]room=([^&#]+)/.exec(text);

  if (qMatch && roomMatch) {
    return {
      kind: "puzzle",
      q: decodeURIComponent(qMatch[1]),
      room: decodeURIComponent(roomMatch[1]),
    };
  }

  // ?pid=... なら pid
  const pidMatch = /[?&]pid=([^&#]+)/.exec(text);
  if (pidMatch) {
    return {
      kind: "pid",
      pid: decodeURIComponent(pidMatch[1]),
    };
  }

  return { kind: "unknown" };
}
