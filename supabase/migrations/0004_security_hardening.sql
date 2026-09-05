-- ============================================================
-- Ratefolio セキュリティ強化
-- Supabaseダッシュボードの SQL Editor に貼り付けて実行する。
--
-- 修正する2点(初心者向け解説):
--
-- 1. profilesが「誰でも全件読める」状態だった。
--    元の設計意図は「公開記録の投稿者名を表示するため」だったが、
--    using (true) は文字通り無条件なので、ログインしていない人でも
--    APIを直接叩けば「このサービスの全ユーザーのIDと表示名の一覧」を
--    取得できてしまう(ユーザー列挙)。
--    公開記録を1件も持たない人の存在まで見えるのは想定外なので、
--    「自分自身」または「公開記録を1件以上持っている人」に絞る。
--
-- 2. Storage(写真)のupdateポリシーに with check が無かった。
--    using は「どの行を操作対象にできるか」の条件、
--    with check は「操作した結果がどうなっていてよいか」の条件。
--    with check が無いと、自分のフォルダにあるファイルを、
--    他人のフォルダのパスへ移動(リネーム)できてしまう余地が残る。
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles: 全件公開をやめる
-- ------------------------------------------------------------
drop policy if exists "profiles_select_all" on public.profiles;

create policy "profiles_select_self_or_public_author"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.entries e
      where e.owner_id = profiles.id
        and e.is_public = true
    )
  );

-- 上のポリシーの判定(「この人は公開記録を持っているか」)を速くするための索引
create index if not exists entries_public_owner_idx
  on public.entries (owner_id)
  where is_public = true;

-- ------------------------------------------------------------
-- 2. Storage: updateにも with check を付ける
-- ------------------------------------------------------------
drop policy if exists "entry_photos_update_own" on storage.objects;

create policy "entry_photos_update_own"
  on storage.objects for update
  using (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
