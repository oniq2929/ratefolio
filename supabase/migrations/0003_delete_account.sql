-- ============================================================
-- Ratefolio 追加スキーマ: アカウント削除用の関数
-- Supabaseダッシュボードの SQL Editor に貼り付けて実行する。
--
-- 設計方針(初心者向け解説):
--
-- 1. `auth.users`(ログインユーザーの本体)を消す操作は、通常のクライアント
--    (ブラウザ)からは直接できない。Supabaseの管理者用API(service_role)を
--    使えば可能だが、そのキーは絶対にブラウザへ渡してはいけない
--    (CLAUDE.mdの方針、渡すとDB全体を誰でも操作できてしまう)。
--
-- 2. そこで、「呼び出した本人のアカウントだけを削除する」という限定された
--    操作だけを行う関数を、あらかじめDB側に用意しておく。この関数には
--    `security definer`という指定を付けており、関数を作った人(プロジェクト
--    所有者)の権限で実行される。これにより、`authenticated`ロール(一般
--    ユーザー)からの呼び出しでも、内部的には`auth.users`を削除できる。
--
-- 3. `auth.users`の行を削除すると、`profiles`/`genres`/`entries`/
--    `formulas`など、`owner_id`が`on delete cascade`で参照している
--    テーブルの行もすべて自動的に削除される(0001_init.sql / 0002_formulas.sql
--    参照)。Storage上の写真ファイルはこの連鎖に含まれないため、
--    アプリ側で先に削除しておく必要がある。
-- ============================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- ログイン中のユーザーだけがこの関数を呼び出せるようにする
grant execute on function public.delete_own_account() to authenticated;
