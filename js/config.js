// ========================================
// サイト全体の設定
// ========================================
// GAS_URL: Google Apps Script をウェブアプリとしてデプロイした後、
//          その URL（https://script.google.com/macros/s/～/exec）を貼り付ける。
//          空のままでもサイトは動作する（進捗はスマホ内にのみ保存され、
//          ダッシュボードには何も表示されない）。
const CONFIG = {
    GAS_URL: "https://script.google.com/macros/s/AKfycbya-TNINQitlIBljWRkZz0E2epCKnD3igKZ9sr9lo19auYWIasJ4cs4-KIXZqxwfef0/exec",

  // 鍵謎の画面を最初に表示してから、この秒数が経過すると
  // 小ヒントを自動表示する（仕様 3-5）
  AUTO_HINT_SECONDS: 180,

  // ダッシュボードの自動更新間隔（秒）
  DASHBOARD_POLL_SECONDS: 10,
};
