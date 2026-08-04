// ========================================
// 運営からのお知らせ（全画面モーダル）
// ========================================
// ダッシュボードの「📢 参加者へメッセージを送る」から配信された
// お知らせを定期的に取りに行き、残り時間や集合指示など「今すぐ
// 気づいてほしい伝令」として、画面いちばん手前にモーダルで出す。
//
// ▼ 使い方
//   HTML側に以下を1つだけ置き、このスクリプトを読み込むだけ。
//   （id・class名は固定。書き換える場合はこのファイルも直すこと）
//     <div class="announce-modal" id="announceBanner" hidden>
//       <div class="announce-modal-box">
//         <div class="announce-modal-icon">📯</div>
//         <p class="announce-modal-text" id="announceText"></p>
//         <button class="btn gold announce-modal-btn" id="announceCloseBtn">わかった！</button>
//       </div>
//     </div>
//
// ▼ 仕組み
//   ・合言葉は不要（中身は運営が書いた文面だけで、進捗などの
//     個人情報は一切含まない）
//   ・気づいてほしい伝令なので短い間隔（POLL_MS）でポーリングする
//   ・「わかった！」を押すと、同じお知らせ（同じid）はもう出さない。
//     見た／閉じたことを localStorage に覚えておくだけ
//   ・運営が新しいお知らせを配信する（idが変わる）と、
//     前のを閉じていても改めて出る
//   ・GAS_URLが未設定、またはGASが旧版（お知らせ機能なし）でも
//     エラーにはせず、静かに何も表示しない
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

    var currentId = null;

    function poll() {
      fetch(CONFIG.GAS_URL + "?mode=announcement", { redirect: "follow" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.ok) return;
          currentId = data.id || null;
          if (!data.text || !currentId) {
            banner.hidden = true;
            return;
          }
          var seen = null;
          try { seen = localStorage.getItem(SEEN_KEY); } catch (e) {}
          if (currentId === seen) return; // 閉じたお知らせと同じなら出さない
          textEl.textContent = data.text;
          banner.hidden = false;
        })
        .catch(function () { /* 取れなくても参加者の操作は止めない */ });
    }

    closeBtn.addEventListener("click", function () {
      banner.hidden = true;
      if (currentId) {
        try { localStorage.setItem(SEEN_KEY, currentId); } catch (e) {}
      }
    });

    poll();
    setInterval(poll, POLL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setUp);
  } else {
    setUp();
  }
})(window);
