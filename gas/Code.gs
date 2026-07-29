// ========================================
// 「O中の封印を解け！」バックエンド（Google Apps Script）
// ========================================
// 使い方は README.md の「GASのセットアップ」参照。
// このスクリプトは「スプレッドシートに紐付いたApps Script」として動かします。
//
// ・doPost : 参加者サイトからのイベント（登録/QR読取/正解/誤答/ヒント）を
//            「events」シートに1行ずつ追記する
// ・doGet  : 運営ダッシュボード用に、チームごとの集計JSONを返す

// このコードの版。ダッシュボードはこの数字を見て、
// 貼り替えと再デプロイが済んでいるかを判定する。
// gas/Code.gs に集計を足したときは、この数字を1つ増やすこと。
const BACKEND_VERSION = 2;

// ダッシュボード閲覧用の合言葉。デプロイ前に必ず好きな文字列に変えること！
const ADMIN_KEY = "oyakomanabi";

const SHEET_NAME = "events";
const HEADER = ["server_ts", "team_id", "team_name", "type", "point", "detail", "client_ts"];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
  }
  return sh;
}

// 参加者サイトからのイベント記録／運営ダッシュボードからの削除操作
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // 運営ダッシュボードからの削除操作（合言葉必須）
    if (data.type === "admin_delete_team" || data.type === "admin_delete_all") {
      if (data.adminKey !== ADMIN_KEY) {
        return json_({ ok: false, error: "認証エラー：合言葉（key）が違います" });
      }
      const lock = LockService.getScriptLock();
      lock.waitLock(5000);
      try {
        if (data.type === "admin_delete_all") {
          deleteAllRows_();
        } else {
          deleteTeamRows_(String(data.teamId || ""));
        }
      } finally {
        lock.releaseLock();
      }
      return json_({ ok: true });
    }

    // 同時書き込みで行が壊れないようにロックを取る
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      getSheet_().appendRow([
        new Date(),
        String(data.teamId || ""),
        String(data.teamName || ""),
        String(data.type || ""),
        data.point ? Number(data.point) : "",
        JSON.stringify(data.detail || {}),
        String(data.clientAt || ""),
      ]);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// 指定チームの記録行だけを削除（ヘッダー行は残す）
function deleteTeamRows_(teamId) {
  if (!teamId) return;
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  // 下から消さないと行番号がズレるので逆順に走査
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1]) === teamId) {
      sh.deleteRow(i + 1); // シートは1始まり
    }
  }
}

// 記録を全削除（ヘッダー行は残す）
function deleteAllRows_() {
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow > 1) {
    sh.deleteRows(2, lastRow - 1);
  }
}

// 運営ダッシュボード用の集計
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.mode !== "dashboard") {
    return json_({ ok: true, version: BACKEND_VERSION, message: "O中の封印を解け！ backend is running." });
  }
  if (p.key !== ADMIN_KEY) {
    return json_({ ok: false, error: "認証エラー：合言葉（key）が違います" });
  }
  return json_({ ok: true, version: BACKEND_VERSION, serverTime: new Date(), teams: aggregate_() });
}

// events シートの全行からチームごとの状態を組み立てる
function aggregate_() {
  const sh = getSheet_();
  const rows = sh.getDataRange().getValues();
  const teams = {};

  for (let i = 1; i < rows.length; i++) {
    const ts = rows[i][0];
    const id = String(rows[i][1]);
    const name = String(rows[i][2]);
    const type = String(rows[i][3]);
    const point = rows[i][4] ? Number(rows[i][4]) : null;

    if (!id) continue;
    if (!teams[id]) {
      teams[id] = {
        teamId: id,
        teamName: name,
        registeredAt: null,
        lastPoint: null,   // 現在地＝最後に読み取ったQRの場所
        lastEventAt: null,
        solved: {},        // {ポイント番号: 正解時刻}
        wrong: {},         // {ポイント番号: 誤答回数}
        hints: [],         // [{point, at, kind}]
        // 扉の謎（5つの鍵を集めたあとの3桁）
        door: { hintAt: null, wrong: 0, solvedAt: null },
        // 最後の謎（大謎）。moonAt/keyAt は2つの仕掛けを見つけた時刻
        secret: { moonAt: null, keyAt: null, hintAt: null, wrong: 0, solvedAt: null },
      };
    }
    const t = teams[id];
    if (name) t.teamName = name;
    t.lastEventAt = ts;

    if (type === "register") t.registeredAt = ts;
    if (point && type !== "start") t.lastPoint = point;
    if (type === "correct" && point) t.solved[point] = ts;
    if (type === "wrong" && point) t.wrong[point] = (t.wrong[point] || 0) + 1;
    if ((type === "hint_click" || type === "hint_auto") && point) {
      t.hints.push({ point: point, at: ts, kind: type });
    }

    // 扉の謎。point 列には数字ではなく "final" が入っているので別扱いにする
    if (type === "final_hint") t.door.hintAt = ts;
    if (type === "final_wrong") t.door.wrong += 1;
    if (type === "final_correct") t.door.solvedAt = ts;

    // 最後の謎（大謎）
    if (type === "secret_moon") t.secret.moonAt = ts;
    if (type === "secret_key") t.secret.keyAt = ts;
    if (type === "secret_hint") t.secret.hintAt = ts;
    if (type === "secret_wrong") t.secret.wrong += 1;
    if (type === "secret_correct") t.secret.solvedAt = ts;
    // ダミー謎のクリア（ダミー番号は detail 列のJSONに入っている）
    if (type === "dummy_correct") {
      try {
        const det = JSON.parse(String(rows[i][5] || "{}"));
        if (det.dummy != null) {
          if (!t._dummySet) t._dummySet = {};
          t._dummySet[det.dummy] = true;
        }
      } catch (e) { /* detailが読めない行は無視 */ }
    }
  }
  return Object.keys(teams).map(function (k) {
    const t = teams[k];
    t.dummySolved = t._dummySet ? Object.keys(t._dummySet).length : 0;
    delete t._dummySet;
    return t;
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
