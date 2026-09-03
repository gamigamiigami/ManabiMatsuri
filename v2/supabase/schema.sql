-- ===========================================================================
-- 應中秘寶調査録（第二回）— Supabase スキーマ
-- ---------------------------------------------------------------------------
-- 使ひ方: Supabase の SQL Editor にこの一枚をそのまま貼つて実行する。
--         何度実行しても同じ結果になるやう書いてある（作り直し不要）。
--
-- ■ 考へ方
--   表には anon（公開鍵の身分）から一切触らせない。
--   RLS を有効にし、ポリシーを一つも置かない ＝ 直接の select/insert は全て拒否。
--   出入口は下の security definer な関数だけで、
--   どの関数も冒頭で「その参加者 ID が participants に居るか」を確かめる。
--   これで anon key が漏れても、他人の記録を覗く事も書き換へる事も出来ない。
--
--   （参加者 ID を総当たりされる余地は残るが、当日の会場限りの催しであり、
--     ID は受付で紙に刷つて手渡す。実害と手間を秤に掛けて、ここまでとした。）
--
-- ■ 進捗の正はこの participant_state.state（JSON 一つ）。
--   形は v2/js/rules.js の頭に書いてある。
--   サーバ側は中身を解釈しない ＝ 謎や点数の規則を変へても SQL は触らずに済む。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. 表
-- ---------------------------------------------------------------------------

-- 参加者。受付で配る ID を、当日の朝までにここへ入れておく
-- （v2/tools/ids.html が insert 文を作る）。
-- team はこの表が正。受付で組を入れ替へたら、ここを update すれば端末に追随する。
create table if not exists public.participants (
  pid         text primary key,
  team        text not null check (team in ('team1', 'team2')),
  label       text,
  -- 受付で誰かの手に渡つた刻。null なら、まだ誰も名乗つてゐない札。
  -- claim_pid() がこの列を立てて一人に割り当てる。
  claimed_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- 既に表がある所へ後から足す場合の面倒を見る（二度実行しても平気）。
alter table public.participants add column if not exists claimed_at timestamptz;

-- 未割当の札を組ごとに素早く引くための索引。
create index if not exists participants_unclaimed_idx
  on public.participants (team, pid) where claimed_at is null;

-- 状態文書。参加者一人につき一行。
create table if not exists public.participant_state (
  pid         text primary key references public.participants(pid) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  version     integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- 解答の記録。正誤に関はらず残す（後で難易度を見直す材料になる）。
create table if not exists public.attempts (
  id          bigint generated always as identity primary key,
  pid         text not null references public.participants(pid) on delete cascade,
  puzzle_id   text not null,
  as_team     text,
  answer      text,
  correct     boolean not null default false,
  via         text,
  client_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists attempts_pid_idx on public.attempts (pid, created_at desc);

-- 二人組。順序に依らず一組を一行にする為、
-- 必ず辞書順で小さい方を pid_low に入れる（check で強制）。
-- これがサーバ側の「同じ二人は二度は組めない」の担保になる。
create table if not exists public.pair_links (
  id           bigint generated always as identity primary key,
  pid_low      text not null references public.participants(pid) on delete cascade,
  pid_high     text not null references public.participants(pid) on delete cascade,
  pool         text,
  question_id  text,
  verified_by  text[] not null default '{}',
  created_by   text,
  created_at   timestamptz not null default now(),
  constraint pair_links_ordered check (pid_low < pid_high),
  constraint pair_links_unique unique (pid_low, pid_high)
);
create index if not exists pair_links_low_idx  on public.pair_links (pid_low);
create index if not exists pair_links_high_idx on public.pair_links (pid_high);

-- ---------------------------------------------------------------------------
-- 2. 締め切り（RLS を有効にし、ポリシーは置かない）
-- ---------------------------------------------------------------------------

alter table public.participants      enable row level security;
alter table public.participant_state enable row level security;
alter table public.attempts          enable row level security;
alter table public.pair_links        enable row level security;

-- 以前の版で置いたポリシーが残つてゐたら消す（この一枚を貼り直せる為）。
drop policy if exists participants_anon      on public.participants;
drop policy if exists participant_state_anon on public.participant_state;
drop policy if exists attempts_anon          on public.attempts;
drop policy if exists pair_links_anon        on public.pair_links;

revoke all on public.participants      from anon, authenticated;
revoke all on public.participant_state from anon, authenticated;
revoke all on public.attempts          from anon, authenticated;
revoke all on public.pair_links        from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 出入口（security definer。冒頭で必ず pid の実在を確かめる）
-- ---------------------------------------------------------------------------
-- 引数名は v2/js/supabase.js の api.* と一字一句合はせてある。
-- 片方だけ変へると「関数が見つからない」で静かに落ちるので注意。

-- 状態を読む。参加者が居なければ null（＝端末側は「知らない ID」と判断する）。
-- 参加者に番号を自動で割り当てる。
--
-- ■ なぜ要るのか
--   参加者に「K017」と手で打たせたくない。打ち間違へれば別人になり、
--   受付で列が止まる。教室の壁に貼る一枚の QR
--   （index.html?team=team1）を読めば、その組の未使用の札が
--   一つ自動で渡る形にする。
--
-- ■ 同時に何十人が読んでも重ならないやうにする
--   for update skip locked を使ふ。二人が同じ瞬間に読んでも、
--   後の一人は「今その行は誰かが押さへてゐる」ので飛ばして次を取る。
--   これを使はずに「未割当の最小を取る」と書くと、
--   教室で一斉に読み取つた瞬間に同じ番号が二人に渡る。
create or replace function public.claim_pid(p_team text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid text;
begin
  if p_team is null or p_team not in ('team1', 'team2') then
    raise exception 'unknown_team';
  end if;

  select pid into v_pid
    from participants
   where team = p_team and claimed_at is null
   order by pid
   for update skip locked
   limit 1;

  if v_pid is null then
    -- 札が尽きた。受付で刷り足すまで待つ事になるので、
    -- 画面側は「受付の者へ」と出す。黙つて誰かの札を
    -- 使ひ回させてはならない（進捗が混ざる）。
    return jsonb_build_object('pid', null, 'team', p_team, 'exhausted', true);
  end if;

  update participants set claimed_at = now() where pid = v_pid;

  return jsonb_build_object('pid', v_pid, 'team', p_team, 'exhausted', false);
end;
$$;

create or replace function public.get_state(p_pid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team  text;
  v_state jsonb;
  v_ver   integer;
begin
  select team into v_team from participants where pid = p_pid;
  if v_team is null then
    return null;
  end if;

  select state, version into v_state, v_ver
    from participant_state where pid = p_pid;

  return jsonb_build_object(
    'state',   v_state,
    'version', coalesce(v_ver, 0),
    'team',    v_team
  );
end;
$$;

-- 状態を書く（上書き。version は毎回 +1）。
-- 併合は端末側（rules.mergeState）が済ませてから送つてくる約束。
-- サーバで併合しないのは、謎や点数の規則を SQL に持ち込まない為である。
create or replace function public.save_state(p_pid text, p_state jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver integer;
begin
  if not exists (select 1 from participants where pid = p_pid) then
    raise exception 'unknown pid';
  end if;

  insert into participant_state as ps (pid, state, version, updated_at)
    values (p_pid, coalesce(p_state, '{}'::jsonb), 1, now())
  on conflict (pid) do update
    set state = excluded.state,
        version = ps.version + 1,
        updated_at = now()
  returning ps.version into v_ver;

  return coalesce(v_ver, 1);
end;
$$;

-- 解答を一件記録する。
create or replace function public.log_attempt(
  p_pid       text,
  p_puzzle_id text,
  p_as_team   text default null,
  p_answer    text default null,
  p_correct   boolean default false,
  p_via       text default null,
  p_client_at timestamptz default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not exists (select 1 from participants where pid = p_pid) then
    raise exception 'unknown pid';
  end if;

  insert into attempts (pid, puzzle_id, as_team, answer, correct, via, client_at)
    values (p_pid, p_puzzle_id, p_as_team, left(coalesce(p_answer, ''), 64),
            coalesce(p_correct, false), p_via, coalesce(p_client_at, now()))
  returning id into v_id;

  return v_id;
end;
$$;

-- 二人組を登録する。既にあれば existing = true で同じ行を返す。
-- どちらの端末から先に呼んでも、返る question_id は同じ一つになる。
create or replace function public.link_pair(
  p_pid         text,
  p_partner     text,
  p_pool        text default null,
  p_question_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low      text;
  v_high     text;
  v_row      pair_links%rowtype;
  v_existing boolean := true;
  v_pteam    text;
begin
  if not exists (select 1 from participants where pid = p_pid) then
    raise exception 'unknown pid';
  end if;
  if not exists (select 1 from participants where pid = p_partner) then
    raise exception 'unknown partner';
  end if;
  if p_pid = p_partner then
    raise exception 'cannot pair with self';
  end if;

  if p_pid < p_partner then
    v_low := p_pid;  v_high := p_partner;
  else
    v_low := p_partner; v_high := p_pid;
  end if;

  select * into v_row from pair_links where pid_low = v_low and pid_high = v_high;

  if not found then
    insert into pair_links (pid_low, pid_high, pool, question_id, created_by)
      values (v_low, v_high, p_pool, p_question_id, p_pid)
    on conflict (pid_low, pid_high) do nothing;
    -- 同時に二台から呼ばれた場合は insert が空振りするので、必ず読み直す。
    select * into v_row from pair_links where pid_low = v_low and pid_high = v_high;
    v_existing := (v_row.created_by is distinct from p_pid);
  end if;

  select team into v_pteam from participants where pid = p_partner;

  return jsonb_build_object(
    'link_id',      v_row.id,
    'existing',     v_existing,
    'verified_by',  v_row.verified_by,
    'partner_team', v_pteam,
    'pool',         v_row.pool,
    'question_id',  v_row.question_id
  );
end;
$$;

-- 答へ合はせの成立を記録する。自分の ID を verified_by に一度だけ足す。
-- already が真なら「この二人の調査は済んでゐる」と画面に出す。
create or replace function public.verify_pair(p_pid text, p_partner text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low     text;
  v_high    text;
  v_already boolean;
  v_by      text[];
begin
  if not exists (select 1 from participants where pid = p_pid) then
    raise exception 'unknown pid';
  end if;

  if p_pid < p_partner then
    v_low := p_pid;  v_high := p_partner;
  else
    v_low := p_partner; v_high := p_pid;
  end if;

  select p_pid = any(verified_by) into v_already
    from pair_links where pid_low = v_low and pid_high = v_high;

  if v_already is null then
    raise exception 'unknown pair';
  end if;

  if not v_already then
    update pair_links
       set verified_by = array_append(verified_by, p_pid)
     where pid_low = v_low and pid_high = v_high
    returning verified_by into v_by;
  else
    select verified_by into v_by
      from pair_links where pid_low = v_low and pid_high = v_high;
  end if;

  return jsonb_build_object('verified_by', v_by, 'already', v_already);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 権限（関数だけを anon に開ける）
-- ---------------------------------------------------------------------------

revoke all on function public.claim_pid(text)                                         from public;
revoke all on function public.get_state(text)                                        from public;
revoke all on function public.save_state(text, jsonb)                                from public;
revoke all on function public.log_attempt(text, text, text, text, boolean, text, timestamptz) from public;
revoke all on function public.link_pair(text, text, text, text)                      from public;
revoke all on function public.verify_pair(text, text)                                from public;

grant execute on function public.claim_pid(text)                                         to anon, authenticated;
grant execute on function public.get_state(text)                                        to anon, authenticated;
grant execute on function public.save_state(text, jsonb)                                to anon, authenticated;
grant execute on function public.log_attempt(text, text, text, text, boolean, text, timestamptz) to anon, authenticated;
grant execute on function public.link_pair(text, text, text, text)                      to anon, authenticated;
grant execute on function public.verify_pair(text, text)                                to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. 集計用の眺め（運営が SQL Editor で見る。anon には開けない）
-- ---------------------------------------------------------------------------
-- 持ち点は台帳（ledger）の合計として毎回足し直す。
-- 合計値を保存してゐないので、ここと端末の表示が食ひ違ふ事は原理的に起きない。
drop view if exists public.v_scoreboard;
create view public.v_scoreboard as
select
  p.pid,
  p.team,
  p.label,
  coalesce((
    select sum((e ->> 'delta')::numeric)
      from jsonb_array_elements(coalesce(s.state -> 'ledger', '[]'::jsonb)) as e
  ), 0)                                                          as points,
  coalesce((
    select count(*)
      from jsonb_object_keys(coalesce(s.state -> 'solved', '{}'::jsonb))
  ), 0)                                                          as solved_count,
  (s.state -> 'seals' ->> 'own')   is not null                    as has_own_seal,
  (s.state -> 'seals' ->> 'other') is not null                    as has_other_seal,
  coalesce((
    select count(*)
      from jsonb_each(coalesce(s.state -> 'links', '{}'::jsonb)) as l(k, v)
     where v ->> 'verifiedAt' is not null
  ), 0)                                                          as pairs_done,
  s.updated_at
from public.participants p
left join public.participant_state s on s.pid = p.pid;

revoke all on public.v_scoreboard from anon, authenticated;
