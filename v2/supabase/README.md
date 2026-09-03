# Supabase の用意（手順書）

この催しは **サーバ無しでも全部動く**。
`v2/js/config.js` の `SUPABASE.url` が空のままなら、進捗は端末の中だけに保存される
（＝**ローカルモード**。開発中・予行演習・当日に通信が死んだときの姿）。

サーバを繋ぐと、次の三つができるやうになる。

1. 参加者が端末を替へても進捗が続く（機種変・電池切れ・借りた端末）
2. 二人組の「同じ相手とは一度きり」をサーバが強制する
3. 運営が手元で全体の進み具合を見られる

以下は **一度きりの作業**。所要 20 分ほど。SQL の知識は要らない（貼つて押すだけ）。

---

## 手順 1 — プロジェクトを作る

1. <https://supabase.com> でアカウントを作り、**New project**。
2. 入れるのは三つだけ。
   - **Name**: 何でもよい（例 `oc2`）
   - **Database Password**: 自動生成のまま。**どこかに控へておく**（後から見られない）
   - **Region**: `Northeast Asia (Tokyo)` を選ぶ。会場からの応答が一番速い
3. 作成に 2 分ほど掛かる。待つ。

> 無料枠で足りる。参加者 200 人・一人 50 回の書き込みでも、
> 行数も転送量も無料枠の 1% に届かない。

---

## 手順 2 — 表と関数を作る

1. 左の **SQL Editor** → **New query**。
2. このフォルダの **`schema.sql` を全文コピーして貼り、Run**。
3. 緑の `Success` が出れば完了。

`schema.sql` は **何度実行しても同じ結果になる**やうに書いてある。
途中で失敗したり、後から作り直したくなつたら、直したものをもう一度全文貼つて Run すればよい
（表の中身は消えない）。

### ここで何が起きたか（読まなくてもよい）

- 表が四つできた: `participants`（参加者名簿）/ `participant_state`（進捗）/
  `attempts`（解答の記録）/ `pair_links`（二人組）
- 四つとも **外から直接は触れない** やうに閉ぢた
- 代はりに、決められた五つの操作（読む・書く・解答を記録する・組む・成立を記録する）だけが
  出入口として開いてゐる。どの出入口も、最初に「その参加者 ID が名簿に居るか」を確かめる

---

## 手順 3 — 参加者 ID を入れる

> **当日、参加者は番号を打ちません。** 教室の入口QR を読むと、
> ここで入れた名簿の中から未使用の番号が自動で一つ渡ります（`claim_pid`）。
> つまりこの手順は「何人ぶんの札を用意しておくか」を決める作業です。
> 実際の人数より少し多めに入れておくと当日あわてません。

受付で配る ID を、当日の朝までに名簿へ入れておく。

1. ブラウザで **`v2/tools/ids.html`** を開く（GitHub Pages 上でも、手元のファイルを開いても可）。
2. 人数を指定すると、次の三つが出る。
   - 印刷用の個人 QR シート（受付で切つて配る）
   - CSV（名簿の控へ）
   - **`insert into participants ...` の SQL**
3. その SQL をコピーし、**SQL Editor** に貼つて Run。

> **多めに刷つておく事。** 当日は必ず「無くした」「濡れた」「読めない」が出る。
> 予備が 1 割あると受付が止まらない。

### 受付で組を入れ替へたくなつたら

ID の頭文字は **初期値でしかない**。名簿の `team` が正なので、SQL Editor で
書き換へれば端末側の表示もその場で追随する（次にそのページを開いたときに切り替はる）。

```sql
update participants set team = 'team2' where pid = 'K017';
```

---

## 手順 4 — 鍵をサイトに貼る

1. 左の **Project Settings** → **API**。
2. 次の二つを写す。
   - **Project URL**（`https://xxxxxxxx.supabase.co`）
   - **anon public** の key（長い文字列）
3. `v2/js/config.js` の `SUPABASE` に貼る。

```js
SUPABASE: {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi....',
},
```

4. コミットして push する。

> **anon key は公開してよい鍵である。** サイトのソースを見れば誰にでも見える前提で作つてある。
> 手順 2 で表を閉ぢてあるので、この鍵だけでは他人の進捗を覗く事も書き換へる事もできない。
> 逆に、**`service_role` の key は絶対に貼らない事**。あれは全権の鍵で、貼つた瞬間に全部筒抜けになる。

---

## 手順 5 — 繋がつたか確かめる

1. 実際の ID を一つ使つて、`.../v2/index.html?pid=K017&debug=1` を開く。
2. 画面の下に出る黒い小窓を見る。
   - `debug — server` と出てゐれば繋がつてゐる（`local (SUPABASE 未設定)` なら手順 4 の貼り忘れ）
   - `pending=0` なら送信の溜まりも無い
3. 「調査を開始する」まで進めてから、**別の端末**（あるいは同じ端末のシークレット窓）で
   同じ `?pid=` を開く。**進捗が引き継がれてゐれば成功**。
4. SQL Editor で全体を見る。

```sql
select * from v_scoreboard order by points desc;
```

---

## 当日の見方（運営用）

SQL Editor に貼つて Run するだけ。

```sql
-- 全体の進み具合
select * from v_scoreboard order by points desc, pid;

-- 組ごとの合計
select team, count(*) as 人数, sum(points) as 合計 from v_scoreboard group by team;

-- 手が止まつてゐる人（誤答が多いのに解けてゐない）
select pid, puzzle_id, count(*) as 誤答
  from attempts where correct = false
 group by pid, puzzle_id having count(*) >= 4
 order by 誤答 desc;

-- 成立した二人組
select pid_low, pid_high, pool, question_id, verified_by, created_at
  from pair_links where array_length(verified_by, 1) = 2
 order by created_at desc;

-- まだ一度も繋がつてゐない人（受付済みだが未開始）
select p.pid, p.team from participants p
  left join participant_state s on s.pid = p.pid
 where s.pid is null;
```

---

## 困つたときは

| 症状 | 見る所 |
| --- | --- |
| 小窓に `local (SUPABASE 未設定)` と出る | 手順 4。`config.js` の url / anonKey が空、または push し忘れ |
| `pending` が増え続ける | 会場の通信が切れてゐる。**遊びは止まらない**ので放つておいてよい。繋がれば自動で送り直す |
| 入口で「その番号は見つからない」と出る | 手順 3 で名簿に入つてゐない ID。SQL Editor で `select * from participants where pid = 'K017';` |
| 進捗が引き継がれない | ブラウザが違ふと ID の保存先も違ふ。`?pid=` 付きの URL から開き直す |
| 全部おかしい | 手順 4 の url / anonKey を空文字に戻せば、その場でローカルモードに落ちて必ず動く。**当日の最後の逃げ道はこれ** |

---

## 片付け（催しの後）

記録を残す必要が無くなつたら、Supabase の Project Settings → General → **Delete project**。
残しておきたい場合は、先に SQL Editor で `select * from v_scoreboard;` の結果を
CSV に落としておく（結果表の右上から書き出せる）。
