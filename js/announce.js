// ========================================
// 運営からのお知らせ（全画面モーダル）
// ========================================
// ダッシュボードの「📢 参加者へメッセージを送る」から配信された
// お知らせを定期的に取りに行き、残り時間や集合指示など「今すぐ
// 気づいてほしい伝令」として出す。
//
// ▼ 使い方
//   HTML側に以下を1つだけ置き、このスクリプトを読み込むだけ。
//   （id・class名は固定。書き換える場合はこのファイルも直すこと）
//     <dialog class="announce-modal" id="announceBanner">
//       <div class="announce-modal-icon">📯</div>
//       <p class="announce-modal-text" id="announceText"></p>
//       <button class="btn gold announce-modal-btn" id="announceCloseBtn">わかった！</button>
//     </dialog>
//
// ▼ 仕組み
//   ・<dialog>のshowModal()で出す。これはブラウザの「トップレイヤー」に
//     描画される特別な仕組みで、ページ内の他の要素がどんなCSS
//     （z-index・transform・overflowなど）を持っていても関係なく、
//     必ず画面のいちばん手前・アプリの上に出る（ページの一部として
//     埋め込まれたバナーとは根本的に別の仕組み）。閉じるまで背後の
//     操作もできない
//   ・合言葉は不要（中身は運営が書いた文面だけで、進捗などの
//     個人情報は一切含まない）
//   ・気づいてほしい伝令なので短い間隔（POLL_MS）でポーリングする
//   ・「わかった！」を押すまで閉じない（Escキーでの取り消しは無効化ずみ）。
//     押すと、同じお知らせ（同じid）はもう出さない。見た／閉じたことを
//     localStorage に覚えておくだけ
//   ・運営が新しいお知らせを配信する（idが変わる）と、
//     前のを閉じていても改めて出る
//   ・短い間隔（POLL_MS）でポーリングするのに加えて、画面を触った瞬間
//     （visibilitychange / focus / pageshow）にも即座に取りに行く。
//     スマホの画面を消していた・タブを離れていた参加者でも、
//     画面に戻ってきた瞬間に検知できるようにするため
//     （※ 画面が消えている・アプリが完全にバックグラウンドの間は
//     　 ブラウザがJSの実行そのものを止めるので、素のWebページである
//     　 以上、画面が消えたままの状態で強制表示することはできない。
//     　 これを本当にやるにはOSのプッシュ通知が必要で、対応ブラウザ・
//     　 通知許可・別立てのプッシュサーバが要る大掛かりな話になる）
//   ・GAS_URLが未設定、またはGASが旧版（お知らせ機能なし）でも
//     エラーにはせず、静かに何も表示しない
//   ・<dialog>のshowModal()に対応していない古いブラウザ向けに、
//     hidden属性での表示切替にフォールバックする
(function (global) {
  "use strict";
  var SEEN_KEY = "fuin_announce_seen_id";
  var POLL_MS = 6000;

  function setUp() {
    // js/config.js の CONFIG は const 宣言なので window.CONFIG にはならない
    // （var 宣言だけが window のプロパティになる）。bare な識別子として
    // 参照する必要がある。typeof チェックなら未定義でも例外にならない。
    if (typeof CONFIG === "undefined" || !CONFIG.GAS_URL) return;
    var banner = document.getElementById("announceBanner");
    var textEl = document.getElementById("announceText");
    var closeBtn = document.getElementById("announceCloseBtn");
    if (!banner || !textEl || !closeBtn) return;

    var canModal = typeof banner.showModal === "function";
    var currentId = null;

    function isOpen() {
      return canModal ? banner.open : !banner.hidden;
    }
    function show() {
      if (canModal) {
        if (!banner.open) banner.showModal();
      } else {
        banner.hidden = false;
      }
    }
    function markSeen() {
      if (currentId) {
        try { localStorage.setItem(SEEN_KEY, currentId); } catch (e) {}
      }
    }
    function hide() {
      if (canModal) {
        if (banner.open) banner.close(); // "close"イベントでmarkSeenが走る
      } else {
        banner.hidden = true;
        markSeen();
      }
    }

    function poll() {
      fetch(CONFIG.GAS_URL + "?mode=announcement", { redirect: "follow" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.ok) return;
          currentId = data.id || null;
          if (!data.text || !currentId) {
            if (isOpen()) hide();
            return;
          }
          var seen = null;
          try { seen = localStorage.getItem(SEEN_KEY); } catch (e) {}
          if (currentId === seen) return; // 閉じたお知らせと同じなら出さない
          textEl.textContent = data.text;
          show();
        })
        .catch(function () { /* 取れなくても参加者の操作は止めない */ });
    }

    closeBtn.addEventListener("click", hide);
    if (canModal) {
      // Escキーでの取り消し（cancelイベント）を封じ、必ずボタンを
      // 押させる。とはいえ閉じられてしまった場合に備え、close時にも
      // 既読を記録しておく（cancelをpreventDefaultすればcloseは
      // 発火しないはずだが、念のため二重で持たせている）。
      banner.addEventListener("cancel", function (e) { e.preventDefault(); });
      banner.addEventListener("close", markSeen);
    }

    poll();
    setInterval(poll, POLL_MS);

    // 画面を閉じていた／タブを離れていた参加者が戻ってきた瞬間に、
    // 次のポーリングを待たず即座に確認する。
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") poll();
    });
    global.addEventListener("focus", poll);
    global.addEventListener("pageshow", poll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setUp);
  } else {
    setUp();
  }
})(window);
