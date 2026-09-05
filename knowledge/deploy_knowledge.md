---
title: "deploy 説明書"
type: knowledge
project: "Ratefolio"
created: "2026-09-05"
updated: "2026-09-05"
version: "v1.0"
tags:
  - type/knowledge
  - "project/Ratefolio"
  - tech/vercel
  - tech/supabase
related:
  - "[[deploy_report]]"
  - "[[supabase_schema_knowledge]]"
  - "[[auth_knowledge]]"
aliases:
  - "deploy"
---

# deploy 説明書

> 対象コード: なし(アプリのコードそのものではなく、GitHub/Vercel/Supabaseの設定作業)
> 対象読者: 作成者本人（学習目的）
> 前提知識レベル: アプリ開発初心者（デプロイ作業は初めて）
> 記述方針: 専門用語は初出のたびにかみ砕いて説明する

---

## 0. この文書の読み方・前提知識

- これまでのRatefolioは、自分のPCで`npm run dev`を実行した時だけ動く状態だった。この章は、それを「誰でもインターネット経由でアクセスできる状態」にする作業(デプロイ)についての記録である。

### 用語集

| 用語 | 意味（平易な説明） | 初出章 |
|---|---|---|
| デプロイ | 作ったアプリを、実際にインターネット上で動く状態にすること | 1 |
| CI/CD(継続的デプロイ) | コードをGitHubに送る(push)たびに、自動でビルド・公開し直してくれる仕組み | 3 |
| 環境変数 | パスワードやAPIキーなど、コードに直接書きたくない値を、実行環境側で設定する仕組み | 3 |

---

## 1. このコードで何をするか（概要）

Ratefolioのフロントエンド(React/Vite)をVercelという無料のホスティングサービスにデプロイし、`https://ratefolio-psi.vercel.app`という実際のURLでアクセスできるようにした。あわせて、Supabaseプロジェクトをムンバイリージョンから東京リージョンへ作り直した。

---

## 2. 背景・なぜこれが必要か

主要機能・デザインが完成した段階で、「自分のPCの中だけで動くアプリ」から「実際に使えるサービス」にする必要があった。また、以前から「Supabaseのリージョンがムンバイになっている」という課題が残っており(実データが増える前に直すのが簡単、と整理していた)、テストデータしか入っていない今のタイミングで両方を一緒に片付けることにした。

---

## 3. 設計思想・アーキテクチャの考え方

### 3.1 GitHub + Vercelで「継続的デプロイ」にする理由

VercelにはCLIから直接デプロイする方法もあるが、今回はGitHubリポジトリと連携させる方式を選んだ。この方式では、`git push`で`main`ブランチを更新するだけで、Vercelが自動的に最新のコードでビルド・公開し直してくれる。今後も[[genres_knowledge|ジャンル管理]]や[[entries_knowledge|記録作成]]のように機能追加のたびにコミットしていく開発スタイルと相性がよく、「デプロイし忘れ」が起きない。

### 3.2 環境変数はVercel側にも別途設定が必要

`.env`ファイルはgitに含まれない(`.gitignore`で除外)ため、GitHub経由でVercelにコードを渡しても、`VITE_SUPABASE_URL`等の値は一緒には渡らない。そのため、Vercelの「Environment Variables」という設定画面に、ローカルの`.env`と同じ内容を別途登録する必要がある。環境変数を変更した場合は、既存のデプロイには反映されないため、「Redeploy」で明示的に再ビルドする必要がある点も実地で確認した。

### 3.3 Supabaseのリージョンは後から変更できない

[[supabase_schema_knowledge|前回]]触れたとおり、Supabaseは既存プロジェクトのリージョンだけを変えることができない。そのため「新しい東京リージョンのプロジェクトを作る→同じマイグレーション(`0001_init.sql`, `0002_formulas.sql`)を流し込む→接続情報を新しいものに差し替える」という、実質的に「作り直し」の手順を取った。テストデータしか入っていない段階だったため、データ移行の手間なく完了できた。

### 3.4 本番URLが決まって初めて、認証設定が完成する

[[auth_knowledge|認証機能]]で発生した「確認メールの戻り先がlocalhostになる」問題は、本番URLが決まって初めて正しく直せる。デプロイ後、Supabase側の「Site URL」「Redirect URLs」を本番URLに向けたうえで、最終的に「Confirm emailは恒久的にオフにする」という仕様を確定させた(詳細は[[auth_knowledge|認証機能の説明書]]3.4節)。

---

## 4. 実装の考え方（作業内容と概念の対応）

| 概念 | 実際の作業 | 補足 |
|---|---|---|
| 継続的デプロイ | GitHubリポジトリ(`oniq2929/ratefolio`)とVercelプロジェクトを連携 | `main`へのpushで自動デプロイ |
| 環境変数の二重管理 | ローカル`.env` + Vercelの Environment Variables | 同じ内容を両方に設定する必要がある |
| リージョン移行 | 新規Supabaseプロジェクト(東京)を作成し、既存マイグレーションSQLを再実行 | データ移行ではなく「作り直し」 |
| 本番向け認証設定 | Supabase の Site URL / Redirect URLs を本番ドメインに設定 | 確認メールの戻り先問題の根本対応 |

---

## 5. 作業の読み方（ステップ・バイ・ステップ）

1. GitHubで空のリポジトリ`ratefolio`を作成し、ローカルの`git remote add origin ...`でつなぎ、`git push -u origin main`でアップロードした。
2. Vercelに**GitHubアカウントで**サインアップし(自動連携)、「Import」でこのリポジトリを選び、Viteプロジェクトとして認識させた。
3. インポート画面でEnvironment Variablesに`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`を設定して「Deploy」した。
4. 新しいSupabaseプロジェクトを東京リージョンで作成し、SQL Editorで`0001_init.sql`→`0002_formulas.sql`を実行した。
5. Vercelの「Environment Variables」で値を新しいプロジェクトのものに更新し、「Redeploy」で再ビルドした。
6. 新しいSupabaseプロジェクトの「Confirm email」をオフにし、「Site URL」「Redirect URLs」を本番URLに設定した。
7. 本番URLで新規登録からレーダーチャート表示までの一連の流れを実機(スマホ)で確認した。

---

## 6. 具体例で動きを追う

1. ローカルで機能追加のコミットを作り、`git push`する
2. GitHubのmainブランチが更新される
3. Vercelがそれを検知し、自動でビルド(`npm run build`相当)を実行する
4. ビルドが成功すると、`https://ratefolio-psi.vercel.app`が新しい内容に置き換わる
5. スマホ・PCどちらからアクセスしても、常に最新のmainブランチの内容が表示される

---

## 7. つまずきやすいポイント・よくある誤解

- **`git push`がタイムアウトすることがある**：HTTPS経由のpushは初回、ブラウザでのGitHubログインを求められることがある。この操作はClaude Codeの実行環境からは完結できないため、ユーザー自身のターミナルで実行する必要があった。
- **環境変数を変えただけでは本番に反映されない**：Vercelは環境変数の変更を検知して自動再ビルドはしてくれないため、「Redeploy」を手動で行う必要がある。
- **Vercelのプラン選択画面で「commercial」を選ぶと有料トライアルが始まる**：個人の非商用プロジェクトでは「personal projects」(Hobbyプラン、無料)を選ぶ必要がある。

---

## 8. 確認問題

1. `.env`ファイルがgitに含まれていないにもかかわらず、Vercel上のアプリがSupabaseに接続できるのはなぜか。
   - 解答例: Vercelの「Environment Variables」に、`.env`と同じ内容を別途設定しているため。ビルド時にこれらの値が`import.meta.env`として埋め込まれる。
2. Supabaseのリージョンを東京に変更する際、「既存プロジェクトの設定変更」ではなく「新規プロジェクトの作成」という手順を取ったのはなぜか。
   - 解答例: Supabaseは既存プロジェクトのリージョンを後から変更する機能を提供しておらず、変更するには新しいリージョンでプロジェクトを作り直すしかないため。
3. GitHub + Vercelの連携によるデプロイ方式のメリットを、Vercel CLIでの直接デプロイと比較して説明せよ。
   - 解答例: `git push`するだけで自動的にビルド・公開まで行われるため、デプロイし忘れが起きない。CLIでの直接デプロイは、その都度コマンドを手動実行する必要がある。

---

## 9. さらに学ぶために

- Vercel公式ドキュメント「Git Integrations」「Environment Variables」
- Supabase公式ドキュメント「Managing Environments」
