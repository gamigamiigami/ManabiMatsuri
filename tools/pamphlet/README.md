# ハンドオフ：親子学び祭パンフレット（A4三つ折り両面）

## 概要
O中学校「親子学び祭」のイベント用A4三つ折りパンフレット。A面（おもて）3パネル＋B面（うら）2パネルの構成。Claude Codeで編集しやすいようにレイヤー・パーツごとに分離した構造で提供。

## デザインファイルについて
このバンドルに含まれるHTMLファイルは**デザインリファレンス**です。実装先の環境（React等）に合わせて再構築してください。`reference.html` が元デザインのフラットHTML、`pamphlet.html` がレイヤー分けされた編集用HTMLです。

## Fidelity
**High-fidelity（ハイファイ）** — 色・タイポグラフィ・余白・装飾すべて最終デザイン。ピクセル単位で再現してください。

---

## 全体仕様

| 項目 | 値 |
|---|---|
| サイズ | A4横置き（297mm × 210mm） |
| デザイン解像度 | 1920px × 1357px |
| 印刷スケール | `transform: scale(0.5847)` で297mm幅にフィット |
| 折り方 | A面＝三つ折り（3等分）、B面＝1:2分割 |

---

## デザイントークン

### カラー
| 名前 | HEX | 用途 |
|---|---|---|
| navy | `#1d2a5e` | メインカラー・テキスト・表紙背景 |
| navy-light | `#26346f` / `#2d3d7d` | 表紙の装飾円・グラデーション |
| gold | `#f5c451` | アクセント・見出し・星装飾 |
| orange | `#e8a020` | ラベル背景・タイムライン色 |
| red | `#b0413e` | 数学カラー・強調バッジ |
| green | `#2a7b5b` | 理科カラー |
| cream | `#fdfaf2` | 基本背景 |
| cream-dark | `#f7f2e4` / `#f4eed8` | ストライプ背景 |
| card-bg | `#f4eedd` | カード・チップ背景 |
| text-sub | `#55503f` | サブテキスト |
| border | `#c9c2ae` / `#ddd5bd` | 折り線・点線ボーダー |

### フォント
| フォント | ウェイト | 用途 |
|---|---|---|
| `Zen Maru Gothic` | 400, 500, 700, 900 | 本文・説明テキスト |
| `RocknRoll One` | 400 | 見出し・ラベル・日付 |

Google Fonts URL:
```
https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&family=RocknRoll+One&display=swap
```

### 共通スタイルパターン
- **ラベルバッジ**: `border-radius:999px; padding:7-8px 22-26px; box-shadow:3-4px 3-4px 0; transform:rotate(-2deg)`
- **カード**: `border-radius:12-14px; padding:14px 20px; box-shadow:3px 3px 0`
- **メッセージカード**: 左ボーダー `border-left:14px solid [color]`
- **折り線**: `border-right:2px dashed #c9c2ae`
- **装飾ドット**: `width:12-14px; height:同; border-radius:50%; opacity:.3-.4`

---

## パネル構成

### A面（おもて）— 3等分グリッド `grid-template-columns: 1fr 1fr 1fr`

#### A1：運営からのメッセージ（左パネル）
- **背景**: `#fdfaf2`（無地）
- **下部装飾バー**: 高さ42px、金色グラデーション
- **背景装飾**: 📐🔬🗝️ の絵文字（opacity .15、回転あり）＋ドット装飾
- **見出し**: 「運営からのメッセージ」RocknRoll One 32px、色 `#f5c451`、text-shadow
- **メッセージカード×3**:
  - A（数学）: 左ボーダー `#b0413e`、アバター円 40px
  - B（理科）: 左ボーダー `#2a7b5b`
  - C（脱出ゲーム）: 左ボーダー `#1d2a5e`、アバター文字色 `#f5c451`

#### A2：開催情報＆もちもの（中央パネル）
- **背景**: 斜めストライプ `repeating-linear-gradient(135deg, #f7f2e4 0, #f7f2e4 26px, #f4eed8 26px, #f4eed8 52px)`
- **見切れイラスト装飾**（4つ、absolute配置で四隅からはみ出し）:
  - 左下: `grimoirebold.png` 480×480px、bottom:-200px left:-140px、opacity .55
  - 右上: `keyWatermarkbold.png` 460×460px、top:-180px right:-160px、opacity .5
  - 右下: `magicCirclebold.png` 500×500px、bottom:-190px right:-150px、opacity .45
  - 左上: `quillbold.png` 400×400px、top:-120px left:-130px、opacity .5
- **「かいさい情報」ラベル**: orange背景バッジ
- **情報テーブル**: 白背景カード内、点線区切り（日時/会場/対象/定員/参加費）
- **「もちもの」ラベル**: navy背景バッジ
- **持ち物チップ**: `#f4eedd`背景、flex-wrap

#### A3：表紙（右パネル）
- **背景**: `radial-gradient(circle at 75% 20%, #2d3d7d 0, #1d2a5e 60%)`
- **装飾円**: 右上・左下に大きな円（#26346f）がはみ出し配置
- **装飾リング**: 金色・オレンジのborder円（opacity .3）
- **「？」文字装飾**: RocknRoll One、120/52/72px、各色、opacity .2-.3
- **絵文字装飾**: 🔑🔍、星★✦
- **上部バッジ**: 「たいけん授業＋謎解き脱出ゲーム」赤背景ピルバッジ
- **メインタイトル**: 「親子学び祭」RocknRoll One 108px、text-shadow `6px 6px 0 #b0413e`
- **サブタイトル**: 「O中の封印を解け！」金色背景ラベル 36px
- **日付**: 「8/9」RocknRoll One 80px、金色、text-shadow赤
- **タグ**: 「親子20組限定」赤ピル＋「無料」緑ピル

### B面（うら）— 1:2分割グリッド `grid-template-columns: 1fr 2fr`

#### B1：タイムスケジュール（左1/3）
- **背景**: `radial-gradient(circle at 50% 100%, #f7f2e4, #fdfaf2 70%)`
- **装飾**: ★✦⏰
- **「タイムスケジュール」ラベル**: orange背景バッジ
- **タイムライン**: flex縦並び、各行＝時刻(82px幅) + ドット(22px円) + カード
  - ドット: `box-shadow: 0 0 0 4px #fdfaf2` で白枠付き
  - 12:15 受付（cream）→ 12:45 オープニング → 13:00 理科（green） → 休憩 → 14:00 数学（red） → 休憩 → 15:10 脱出ゲーム（navy、金色shadow `6px 6px 0 #f5c451`、rotate -0.8deg） → 16:30 終了

#### B2-B3：校内マップ（右2/3）
- **背景**: `radial-gradient(circle at 30% 40%, #2d3d7d 0, #1d2a5e 55%)`
- **ドットパターン**: `radial-gradient(#3a4a8f 2px, transparent 2px); background-size:48px 48px; opacity:.12`
- **装飾**: ？文字、★✦、ドット
- **「かいじょうマップ」ラベル**: 金色背景バッジ 44px
- **マップエリア**: 点線ボーダー枠（ここにマップ画像を配置）
- **凡例**: 受付(orange)/理科(green)/数学(red)/脱出ゲーム(navy)/トイレ(gray) のカラードット付きチップ

---

## アセット一覧

| ファイル | 用途 |
|---|---|
| `assets/grimoirebold.png` | A2左下の見切れイラスト（魔導書） |
| `assets/keyWatermarkbold.png` | A2右上の見切れイラスト（鍵） |
| `assets/magicCirclebold.png` | A2右下の見切れイラスト（魔法陣） |
| `assets/quillbold.png` | A2左上の見切れイラスト（羽ペン） |

---

## ファイル一覧

| ファイル | 説明 |
|---|---|
| `reference.html` | 元デザイン（DC形式） |
| `pamphlet.html` | レイヤー分け・編集用HTML |
| `assets/` | イラスト画像 |

---

## 編集ガイド（Claude Code向け）

`pamphlet.html` はパネルごとに `<!-- PANEL: A1 -->` 等のコメントで区切られています。

### テキスト変更
各パネル内の `.content` レイヤー内のテキストを直接編集。

### 装飾変更
各パネル内の `.decorations` レイヤーがabsolute配置の装飾要素。position/opacity/transformを調整。

### カラー変更
先頭の `:root` CSS変数を変更すれば全体に反映。

### イラスト差し替え
`assets/` 内の画像を同名で差し替え。サイズはCSS側で制御。

### マップ画像の差し込み
B2-B3パネルの `<!-- MAP_PLACEHOLDER -->` 部分を `<img>` に差し替え。
