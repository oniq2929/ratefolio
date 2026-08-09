-- ============================================================
-- Ratefolio 初期スキーマ
-- Supabaseダッシュボードの SQL Editor に貼り付けて実行する。
--
-- 設計方針(初心者向け解説):
--
-- 1. genres / axes (ジャンル・評価軸) は「常に本人のみが読み書きできる」
--    設計にしている。他ユーザーが公開記録を見るときも、genres/axesテーブル
--    には一切アクセスしない。
--
-- 2. その代わり、entries(記録)を作成する瞬間に、ジャンル名・評価軸名・
--    スケール(何段階か)を entries / entry_scores 側に「スナップショット
--    (コピー)」として保存する。
--    理由は2つ:
--      a) RLS(行レベルセキュリティ)がシンプルになる。
--         「公開記録を見せる」ためだけに genres/axes テーブルへ複雑な
--         JOIN付きの公開ポリシーを書く必要がなくなり、事故(意図しない
--         非公開データの漏洩)が起きにくくなる。
--      b) あとでジャンル名や評価軸名を変更・削除しても、過去に書いた
--         記録の表示内容が変わらない(記録した当時の名前のまま残る)。
--
-- 3. RLS(Row Level Security)は「テーブルの行ごとに、誰が読み書きできるかを
--    データベース自身が強制する仕組み」。アプリのコードにバグがあっても、
--    DBがブロックしてくれるので「非公開データが他人に見える」事故を防げる。
-- ============================================================

-- UUIDを生成するための拡張機能を有効化
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles: 表示名などの公開プロフィール情報
-- auth.users (Supabase Authが管理するユーザーテーブル)に1:1で対応する。
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 表示名は公開一覧で「誰の記録か」を表示するために誰でも読めてよい
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- 自分のプロフィールだけ更新できる
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 新規ユーザー登録時、自動でprofilesに1行作るトリガー
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- genres: ユーザーが自由に作るジャンル(蕎麦・ビール・本…)
-- 常に本人のみアクセス可能(他ユーザーからは一切見えない)
-- ------------------------------------------------------------
create table public.genres (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- そのジャンルの評価軸が何段階評価か(例: 5段階 / 10段階)。
  -- 「評価軸のスケールをジャンルごとに可変にする」という方針に対応。
  scale_max smallint not null default 5 check (scale_max between 2 and 10),
  created_at timestamptz not null default now()
);

alter table public.genres enable row level security;

create policy "genres_all_own"
  on public.genres for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ------------------------------------------------------------
-- axes: ジャンルに紐づく評価軸(コシ・出汁・蕎麦感…など、n個)
-- 所有者はaxes自体には持たず、genres経由で判定する。
-- ------------------------------------------------------------
create table public.axes (
  id uuid primary key default gen_random_uuid(),
  genre_id uuid not null references public.genres (id) on delete cascade,
  name text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.axes enable row level security;

create policy "axes_all_own"
  on public.axes for all
  using (
    exists (
      select 1 from public.genres g
      where g.id = axes.genre_id and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.genres g
      where g.id = axes.genre_id and g.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- entries: 1件の記録(店・本・場所など)
-- 公開/非公開はここで一元管理する。
-- ------------------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,

  -- 作成時点のジャンルへの参照(ジャンル削除後もnullになるだけで記録は残る)
  genre_id uuid references public.genres (id) on delete set null,
  -- 作成時点のジャンル名・スケールのスナップショット(表示用)
  genre_name text not null,
  scale_max smallint not null,

  target_name text not null,
  entry_date date not null default current_date,

  -- Supabase Storage上のオブジェクトパス(例: "u123/e456.jpg")。
  -- Base64埋め込みではなく、Storageへの参照のみを保存する。
  photo_path text,

  comment text,
  tags text[] not null default '{}',

  is_public boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entries enable row level security;

-- 閲覧: 自分の記録は常に見える。他人の記録は公開フラグがtrueのときだけ見える。
create policy "entries_select_own_or_public"
  on public.entries for select
  using (auth.uid() = owner_id or is_public = true);

create policy "entries_insert_own"
  on public.entries for insert
  with check (auth.uid() = owner_id);

create policy "entries_update_own"
  on public.entries for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "entries_delete_own"
  on public.entries for delete
  using (auth.uid() = owner_id);

-- updated_at を自動更新するトリガー
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- entry_scores: 記録1件 × 評価軸1個 ごとのスコア
-- axis_name はスナップショット(評価軸名を後で変更しても記録は変わらない)
-- ------------------------------------------------------------
create table public.entry_scores (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  axis_id uuid references public.axes (id) on delete set null,
  axis_name text not null,
  sort_order smallint not null default 0,
  score smallint not null check (score >= 1),
  unique (entry_id, sort_order)
);

alter table public.entry_scores enable row level security;

-- entry_scoresは親entryの公開/非公開設定に従う
create policy "entry_scores_select_via_entry"
  on public.entry_scores for select
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_scores.entry_id
        and (e.owner_id = auth.uid() or e.is_public = true)
    )
  );

create policy "entry_scores_write_via_entry"
  on public.entry_scores for all
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_scores.entry_id and e.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_scores.entry_id and e.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Storage: 記録写真を保存するバケット
-- パスは "{owner_id}/{entry_id}.拡張子" という規約にする。
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', false)
on conflict (id) do nothing;

-- 自分のフォルダ(先頭が自分のuser id)にのみアップロード・上書き・削除できる
create policy "entry_photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "entry_photos_update_own"
  on storage.objects for update
  using (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "entry_photos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 閲覧: 自分の写真、または公開記録に紐づく写真(entries.photo_pathと一致)だけ見える
create policy "entry_photos_select_own_or_public"
  on storage.objects for select
  using (
    bucket_id = 'entry-photos'
    and exists (
      select 1 from public.entries e
      where e.photo_path = storage.objects.name
        and (e.owner_id = auth.uid() or e.is_public = true)
    )
  );

-- ------------------------------------------------------------
-- 検索用インデックス
-- ------------------------------------------------------------
create index entries_owner_id_idx on public.entries (owner_id);
create index entries_genre_id_idx on public.entries (genre_id);
create index entries_public_idx on public.entries (is_public) where is_public = true;
create index entries_tags_idx on public.entries using gin (tags);
create index axes_genre_id_idx on public.axes (genre_id);
create index entry_scores_entry_id_idx on public.entry_scores (entry_id);
