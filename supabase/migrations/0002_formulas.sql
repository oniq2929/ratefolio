-- ============================================================
-- Ratefolio 追加スキーマ: カスタム評価式(formulas)
-- Supabaseダッシュボードの SQL Editor に貼り付けて実行する。
--
-- 設計方針(初心者向け解説):
--
-- 1. 評価軸ごとに好きな重みを掛けて足し算する「線形結合」の式
--    (例: 3×コシ + 1×出汁 - 1×量) を、ユーザーが自由に登録・保存できる
--    ようにするテーブル。
--
-- 2. 重み(weights列)は axes.id ではなく、評価軸の「名前」をキーにした
--    JSONBオブジェクトとして保存する(例: {"コシ": 3, "出汁": 1}) 。
--    これは、entries/entry_scoresが「軸名のスナップショット」を持つ設計
--    (0001_init.sqlの方針)と合わせるためで、こうすることで
--      a) 自分の別ジャンルの記録にも(軸名が同じなら)同じ式を使い回せる
--      b) 他ユーザーの公開記録(entry_scores.axis_name)にも、自分の式を
--         そのまま当てはめて計算できる(公開ランキングでの利用を想定)
--    という利点がある。
--
-- 3. formulas自体はgenres/axesと同じく「常に本人のみが読み書きできる」
--    設計にしている。他ユーザーの式を覗いたり使ったりすることはできない
--    (あくまで自分の式を、自分が見ている記録の計算に使うだけ)。
-- ============================================================

create table public.formulas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  genre_name text not null,
  name text not null,
  weights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.formulas enable row level security;

create policy "formulas_all_own"
  on public.formulas for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index formulas_owner_id_idx on public.formulas (owner_id);
create index formulas_genre_name_idx on public.formulas (genre_name);
