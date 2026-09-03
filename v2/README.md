# 應中秘寶調査録 - v2（2027年度版）

親子學び祭り 第二回 対象の中学生向けスマホ謎解きサイト。

## 概要と第一版との違い

**v2** は第一版（このリポジトリのルート `/` にある）をベースに、以下の改善を加えた実装です：

### 第一版の成果を活かし、新しい技術的選択肢で再実装
- **ビルドステップなし**：HTML + CSS + 素のES6モジュールのみ。npm, webpack などが不要
- **Supabase ベース**：参加者の進捗・解答を Supabase に保存（ローカルモードでのテストもサポート）
- **GitHub Pages で配信**：パッケージング・デプロイが最小限

### 第一版から学んだ教訓
- QR 読み取り機を改善：`jsQR` の `inversionAttempts: 'dontInvert'` オプションで読み取り精度を向上
- 参加者 ID の単一ソース：`config.js` でチーム名・部屋名・色を集約管理（複数ファイルに分散させない）
- 印刷物の QR コード品質：クワイエットゾーン（静穏領域）は4モジュール以上必須
- ローカルテストの重要性：スモークテスト（smoke.mjs）で事前検証

## ローカル実行

### 前提
- Node.js 22 以上（`/opt/node22/` にインストール済み）
- Playwright 1.56.1 （スモークテスト実行時）
- Python 3（ローカルサーバ起動時）

### 手順

1. **リポジトリのルートから HTTP サーバーを起動**
   ```bash
   cd /home/user/ManabiMatsuri
   python3 -m http.server 8765
   ```

2. **ブラウザで開く**
   ```
   http://127.0.0.1:8765/v2/
   ```

3. **ローカルモードであることを確認**
   ```javascript
   // ブラウザコンソールで実行
   import('./v2/js/config.js').then(m => console.log(m.CONFIG.SUPABASE));
   // url が空文字列なら OK
   ```

## 設定ファイル

### `v2/js/config.js` - 唯一の設定マスター
このファイルに全てのチーム情報が集約されています。**ハードコードされた文字列は使用禁止**。

```javascript
export const CONFIG = {
  SITE: { title, subtitle, dateLabel, baseUrl },
  TEAMS: {
    team1: {
      key: 'K',
      name: '甲組',
      short: '甲',
      romaji: 'Team Kō',
      color: '#a33520',
      colorInk, colorBright, colorName: '朱',
      roomName: '甲組教室',
      idPrefix: 'K'
    },
    team2: { ... }
  },
  TEAM_ORDER: ['K', 'O'],
  ROOMS: { ... },
  MANUAL_CODES: { 201: {q, room}, ... },
  SUPABASE: { url: '', key: '' },  // ローカル = url=""
  DEBUG_ENABLED: false
};
```

- チーム名、部屋名、色名は **config.js のみ** に定義
- HTML ファイル・ツール内で定数をレンダリングするときは `CONFIG` オブジェクト経由
- `v2/tools/check-config-literals.mjs` でハードコード検査を実施

## ローカルモード vs Supabase モード

### ローカルモード（開発・テスト時）
```javascript
SUPABASE: { url: '', key: '' }
```
- 参加者の進捗は `localStorage` に保存
- Supabase への通信なし
- スモークテスト実行時は必ずこのモードで（実データ上書き防止）

### Supabase モード（本番）
```javascript
SUPABASE: { url: 'https://...', key: 'eyJ...' }
```
- 参加者の進捗をリアルタイムでクラウドに同期
- 複数端末での再開・参加者アナリティクスに対応

## デプロイ（GitHub Pages）

### ステップ
1. `v2/js/config.js` を本番設定に編集
   - `SUPABASE.url` を実際の Supabase プロジェクト URL に
   - `SUPABASE.key` を API キーに
   - `DEBUG_ENABLED` を `false` に

2. コミット・プッシュ
   ```bash
   git add v2/
   git commit -m "Production release for 2027-01-09"
   git push origin main
   ```

3. GitHub Pages が自動デプロイ（`.github/workflows/pages.yml` による）

### サイト URL
```
https://{org}.github.io/ManabiMatsuri/v2/
```

## 参加者 ID・謎 QR コード の生成と印刷

### 当日の入場（本筋）— 教室の入口QR

**参加者は番号を一切打ちません。** 教室の壁と画面に貼った一枚の QR
（`index.html?team=team1`）を読むと、その組の未使用の番号が自動で一つ渡ります。

- 生成場所：`tools/ids.html` の冒頭「教室の入口QR」。組ごとに一枚。
- 教卓・壁・投影画面の三か所に同じものを貼ると、席から遠い人も読めます。
- 番号の重複は起きません。同時に何十人が読んでも、
  データベース側（`claim_pid`）が一人に一つずつ渡します。
- 名簿の札が尽きると「この組の札が尽きた」と出ます。
  その場合は `tools/ids.html` で人数を増やして SQL を追加投入してください。
  黙って代用の番号を作らないのは、後で進捗が混ざるのを防ぐためです。

> 参加者に「K017」と手で打たせない設計にしてあります。
> 打ち間違えればその場で別人の記録になり、受付で列が止まります。

### 参加者 ID カード（配る場合の選択肢）

一人ずつ紙の札を配る運用にしたい場合は、こちらも使えます
（`index.html?pid=K017` を埋めた個人QR）。入口QRと併用できます。

1. **ID一覧を生成**
   ```bash
   # ブラウザで以下を開く
   http://127.0.0.1:8765/v2/tools/ids.html
   ```

2. **フォームに入力**
   - 甲組の人数：例 30
   - 乙組の人数：例 30
   - 「生成する」をクリック

3. **出力を利用**
   - CSV / SQL を Supabase にインポート
   - QR カード一覧を印刷（Ctrl+P）
     - 用紙：A4、余白：なし（100%表示）
     - 各カードには QR、ID（大文字）、チーム名が記載

### 謎 QR ポスター（会場に掲示）

1. **ポスターを生成**
   ```bash
   # ブラウザで以下を開く
   http://127.0.0.1:8765/v2/tools/qr-puzzles.html
   ```

2. **フォームに入力**
   - ベースURL：自動で設定（カスタマイズ可）
   - 「ポスターを生成」をクリック

3. **印刷**
   - Ctrl+P で印刷ダイアログを開く
   - 用紙：A4、余白：なし（100%表示）
   - 各ポスターの下に「STAFF ONLY」の耳が付いているので、**貼付時に切り取ってください**
     （そうしないと参加者がどの謎のQRかを模様で見分けられてしまう）

## チェック・テストスクリプト

### 1. ハードコード検査（`check-config-literals.mjs`）

チーム名などが誤ってハードコードされていないか確認：

```bash
node v2/tools/check-config-literals.mjs
```

実行結果：
- ✓ がなければ OK
- ❌ が出た場合は、該当ファイルを編集して `CONFIG` 経由に修正

### 2. スモークテスト（`smoke.mjs`）

基本フローの自動テスト：

```bash
node v2/tools/smoke.mjs [outDir]
```

実行内容：
1. HTTP サーバーを起動
2. **ログイン**：`index.html?pid=K017` で参加者 ID をセット
3. **スキャン**：`scan.html` で手入力（201 番）
4. **謎解き**：解答入力・検証
5. **協力謎**：`together.html` での連携
6. **エラーハンドリング**：無効な ID 検査
7. スクリーンショットを `outDir/` に保存

## イベント当日チェックリスト

### 準備段階（2日前〜前日）

- [ ] `v2/js/config.js` を本番設定に変更
  - [ ] `SUPABASE.url` と `key` を入力
  - [ ] `DEBUG_ENABLED = false`
  - [ ] チーム名・部屋名をチェック

- [ ] Supabase の `participants` テーブルに参加者情報をインポート
  - [ ] `v2/tools/ids.html` から SQL を生成・実行

- [ ] 謎 QR コードを全数印刷・裁断
  - [ ] `v2/tools/qr-puzzles.html` から印刷
  - [ ] 各ポスターの「STAFF ONLY」の耳を切り取り確認

- [ ] 参加者 ID カードを印刷・配布
  - [ ] `v2/tools/ids.html` から印刷
  - [ ] 配布リスト・不足分の予備を用意

### 動作確認（前日夕方〜当日朝）

- [ ] ローカルで全ページを手動確認
  - [ ] `python3 -m http.server 8765` を起動
  - [ ] 各ページが 404 なく読み込めることを確認

- [ ] 本番環境（Supabase + GitHub Pages）で動作確認
  - [ ] `https://{org}.github.io/ManabiMatsuri/v2/` が開けるか
  - [ ] 複数デバイスから接続テスト

- [ ] スモークテストを実行
  ```bash
  node v2/tools/smoke.mjs
  ```
  - [ ] All Passed で終了

- [ ] **QR コードを全数デコード**
  - [ ] 専用スキャナーまたは `scan.html` で読み取り試験
  - [ ] ID カード・謎ポスターの QR が正しく機能することを確認

### 当日朝

- [ ] 会場 Wi-Fi / LTE の接続テスト
  - [ ] iOS・Android 両方で試す
  - [ ] キャッシュを清除して再度試す

- [ ] **プライベートモードを無効化するよう参加者に案内**
  - [ ] Safari の「プライベート」タブでは localStorage が機能しない
  - [ ] 通常モードでブラウザを開くよう説明

- [ ] 参加者の デバイスを満充電に
  - [ ] カメラ使用で電池消費が多い

- [ ] スタッフ がカメラ許可設定を準備
  - [ ] 受付でカメラ許可をあらかじめ許可しておくと、ゲーム開始時の待ち時間が減る

### 当日中

- [ ] 謎の配置確認・QR ポスターの貼付
  - [ ] スタッフ用の「STAFF ONLY」耳が見えていないか確認

- [ ] トラブル時の対応
  - [ ] QR が読めない→ID 番号を手入力（`scan.html` の番号欄）
  - [ ] サイトが開けない→ネットワークの再接続
  - [ ] localStorage が壊れた→ブラウザのデータ削除

## ファイル構成

```
v2/
├── index.html          # ログイン・ホーム
├── scan.html           # QR スキャン（カメラ）
├── sheet.html          # 謎の詳細・解答フォーム
├── seal.html           # クリア画面
├── together.html       # 協力謎
├── folio.html          # 進捗確認
├── submit.html         # クロスワード謎など
│
├── js/
│   ├── config.js       # ⭐ 唯一の設定マスター
│   ├── rules.js        # 謎解きロジック（純 JS、Node 対応）
│   ├── puzzles.js      # 謎データ
│   ├── qr-scan.js      # カメラ読み取りモジュール
│   ├── qr-gen.js       # QR 生成モジュール
│   └── vendor/         # 外部ライブラリ（jsQR, qrcode-generator, supabase）
│
├── css/
│   └── style.css       # サイト全体のスタイル
│
├── tools/
│   ├── ids.html        # 参加者 ID・QR カード生成（運営用）
│   ├── qr-puzzles.html # 謎ポスター QR 生成（運営用）
│   ├── check-config-literals.mjs  # ハードコード検査スクリプト
│   └── smoke.mjs       # スモークテスト（自動テスト）
│
├── design/             # デザインスクリーンショット
├── supabase/           # スキーマ・セットアップ手順
└── README.md           # このファイル
```

## トラブルシューティング

### 「このURLは見慣れません」と出る
- 謎 QR の URL 形式をチェック（`sheet.html?q=...&room=...` の形でなければダメ）
- 参加者 ID カードの QR は `index.html?pid=...` 形式であることを確認

### localStorage が壊れている
- ブラウザの開発者ツール（DevTools）> Application > Local Storage > このサイトを削除
- 再度ログイン

### Supabase に接続できない
- ローカルモード（`CONFIG.SUPABASE.url = ''`）で動いているか確認
- 本番環境なら、ネットワーク接続・API キーを確認

### スモークテストが失敗する
- `config.js` がローカルモード（`url = ''`）であることを確認
- ページのセレクタが変わっていないか（Track A の実装と照合）
- `out/` ディレクトリのスクリーンショットで詳細を確認

## 参考資料

- 第一版の実装・学習ドキュメント：`/謎解きサイトの作り方と注意点.md`
- Supabase 設定：`v2/supabase/README.md`
- デザイン案：`v2/design/`

---

**作成：Claude Code**  
**最終更新：2026-09-03**
