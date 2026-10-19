-- ============================================================
-- Ratefolio 追加スキーマ: プロパティ / 保存の高速化 / 写真アップロードの修正
-- Supabaseダッシュボードの SQL Editor に貼り付けて実行する。
--
-- 設計方針(初心者向け解説):
--
-- 1. プロパティ(都道府県・店・温度・純米/大吟醸…)
--    Obsidianのプロパティと同じく、ジャンルごとに「項目名＋型」を定義する。
--    型は text(自由入力) / number(数値) / select(選択肢) /
--    prefecture(都道府県・日本地図と連動) / country(国・世界地図と連動)。
--    - 定義(genre_properties)は genres/axes と同じく「本人のみ」読み書き可。
--    - 各記録の値は entries.properties に [{name, type, value}, ...] の形で
--      スナップショットとして保存する(評価軸名と同じ考え方。後で定義を
--      変更・削除しても、過去の記録の値は残る)。
--      entries の公開/非公開ルール(RLS)がそのまま適用されるので、
--      非公開記録のプロパティが他人に見えることはない。
--
-- 2. 保存の高速化
--    これまでは「記録の作成」「スコアの作成」を別々の通信で順番に送っていた。
--    これを1つのDB関数(create_entry / update_entry)にまとめ、1回の通信で
--    済むようにする。関数の中は1つのトランザクションなので、途中で失敗すると
--    すべて取り消され、「スコアのない記録」が残ることもない。
--    security invoker(呼び出したユーザーの権限で実行)にしているので、
--    RLSはそのまま効く。owner_idはクライアントの値を信用せず auth.uid() を使う。
--
-- 3. 写真アップロードの修正
--    Storageの閲覧(select)ポリシーが「entries.photo_pathと一致するファイル」
--    だけを許可していたため、まだ記録に紐づいていない自分のファイルを
--    上書き(upsert)しようとすると権限エラーになる場合があった。
--    「自分のフォルダのファイル」も閲覧可にする(他人のフォルダは従来どおり不可)。
-- ============================================================

-- ------------------------------------------------------------
-- 1. プロパティ
-- ------------------------------------------------------------
create table public.genre_properties (
  id uuid primary key default gen_random_uuid(),
  genre_id uuid not null references public.genres (id) on delete cascade,
  name text not null,
  type text not null check (type in ('text', 'number', 'select', 'prefecture', 'country')),
  -- select型の選択肢(例: {純米, 吟醸, 大吟醸})。他の型では空
  options text[] not null default '{}',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.genre_properties enable row level security;

create policy "genre_properties_all_own"
  on public.genre_properties for all
  using (
    exists (
      select 1 from public.genres g
      where g.id = genre_properties.genre_id and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.genres g
      where g.id = genre_properties.genre_id and g.owner_id = auth.uid()
    )
  );

create index genre_properties_genre_id_idx on public.genre_properties (genre_id);

alter table public.entries
  add column properties jsonb not null default '[]'::jsonb
  check (jsonb_typeof(properties) = 'array');

-- ------------------------------------------------------------
-- 2. 記録の作成・更新を1回の通信で行う関数
-- ------------------------------------------------------------
create or replace function public.create_entry(p_entry jsonb, p_scores jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := coalesce((p_entry ->> 'id')::uuid, gen_random_uuid());
begin
  insert into public.entries (
    id, owner_id, genre_id, genre_name, scale_max, target_name, entry_date,
    comment, tags, is_public, photo_path, properties
  ) values (
    v_id,
    auth.uid(),
    (p_entry ->> 'genre_id')::uuid,
    p_entry ->> 'genre_name',
    (p_entry ->> 'scale_max')::smallint,
    p_entry ->> 'target_name',
    (p_entry ->> 'entry_date')::date,
    p_entry ->> 'comment',
    array(select jsonb_array_elements_text(coalesce(p_entry -> 'tags', '[]'::jsonb))),
    coalesce((p_entry ->> 'is_public')::boolean, false),
    p_entry ->> 'photo_path',
    coalesce(p_entry -> 'properties', '[]'::jsonb)
  );

  insert into public.entry_scores (entry_id, axis_id, axis_name, sort_order, score)
  select
    v_id,
    (s ->> 'axis_id')::uuid,
    s ->> 'axis_name',
    (s ->> 'sort_order')::smallint,
    (s ->> 'score')::smallint
  from jsonb_array_elements(p_scores) as s;

  return v_id;
end;
$$;

create or replace function public.update_entry(p_id uuid, p_entry jsonb, p_scores jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.entries set
    target_name = p_entry ->> 'target_name',
    entry_date = (p_entry ->> 'entry_date')::date,
    comment = p_entry ->> 'comment',
    tags = array(select jsonb_array_elements_text(coalesce(p_entry -> 'tags', '[]'::jsonb))),
    is_public = coalesce((p_entry ->> 'is_public')::boolean, false),
    photo_path = p_entry ->> 'photo_path',
    properties = coalesce(p_entry -> 'properties', '[]'::jsonb)
  where id = p_id and owner_id = auth.uid();

  if not found then
    raise exception '記録が見つかりません';
  end if;

  -- p_scores: [{id, score}, ...]
  update public.entry_scores es set score = (s ->> 'score')::smallint
  from jsonb_array_elements(p_scores) as s
  where es.id = (s ->> 'id')::uuid and es.entry_id = p_id;
end;
$$;

grant execute on function public.create_entry(jsonb, jsonb) to authenticated;
grant execute on function public.update_entry(uuid, jsonb, jsonb) to authenticated;
revoke execute on function public.create_entry(jsonb, jsonb) from public, anon;
revoke execute on function public.update_entry(uuid, jsonb, jsonb) from public, anon;

-- ------------------------------------------------------------
-- 3. Storage: 自分のフォルダのファイルは閲覧可にする
-- ------------------------------------------------------------
drop policy if exists "entry_photos_select_own_or_public" on storage.objects;

create policy "entry_photos_select_own_or_public"
  on storage.objects for select
  using (
    bucket_id = 'entry-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.entries e
        where e.photo_path = storage.objects.name
          and e.is_public = true
      )
    )
  );
