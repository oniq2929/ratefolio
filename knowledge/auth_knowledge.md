---
title: "auth 説明書"
type: knowledge
project: "Ratefolio"
created: "2026-09-01"
updated: "2026-09-01"
version: "v1.0"
tags:
  - type/knowledge
  - "project/Ratefolio"
  - tech/supabase
  - tech/react
related:
  - "[[auth_report]]"
  - "[[supabase_schema_knowledge]]"
aliases:
  - "auth"
---

# auth 説明書

> 対象コード: `src/contexts/AuthContext.tsx`, `src/pages/LoginPage.tsx`, `src/pages/HomePage.tsx`, `src/App.tsx`
> 対象読者: 作成者本人（学習目的）
> 前提知識レベル: アプリ開発初心者（DB・SQL・Reactいずれも初めて）
> 記述方針: 専門用語は初出のたびにかみ砕いて説明する

---

## 0. この文書の読み方・前提知識

このコードを理解するために、最低限次の考え方を押さえておくとよい。

- 前回の[[supabase_schema_knowledge|supabase_schemaの説明書]]で出てきた「RLS」「`auth.uid()`」は、今回作る**ログイン機能があって初めて意味を持つ**。ログインしていなければ`auth.uid()`は常に`null`だった。
- Reactの「Context」という、コンポーネント間で値を共有する標準機能。

### 用語集

| 用語 | 意味（平易な説明） | 初出章 |
|---|---|---|
| セッション(session) | 「今このブラウザはログイン済みである」という状態を表す情報のかたまり。トークン(合言葉のようなもの)を含む | 1 |
| JWT | セッションの中身を表す、改ざん検知付きの文字列形式のトークン | 3 |
| Context | Reactの機能。「箱」を1つ作ると、その箱の中身をアプリ内のどのコンポーネントからでも読み書きできるようにする仕組み | 3 |
| フック(hook) | `useState`や`useEffect`のような、Reactコンポーネントの中で状態や副作用を扱うための関数 | 4 |
| リスナー(listener) | 「何かが起きたら知らせてね」と登録しておく仕組み。ここではログイン/ログアウトが起きた瞬間に呼ばれる | 4 |

---

## 1. このコードで何をするか（概要）

メールアドレスとパスワードで新規登録・ログインできる画面(`LoginPage`)と、「今ログイン中かどうか」をアプリ全体で共有する仕組み(`AuthContext`)を作るコードである。ログインしていなければトップページ(`HomePage`)を見せず、`/login`に自動で誘導する。

---

## 2. 背景・なぜこれが必要か

CLAUDE.mdには「認証は自作せず、Firebase Auth / Supabase Auth / Clerk等の既存認証サービスを利用する方針」と明記されている。これは、パスワードの保存・暗号化・セッション管理といった、間違えるとセキュリティ事故に直結する部分を自前で実装しないためである。

また、[[supabase_schema_knowledge|前回作ったDBスキーマ]]のRLSポリシーは、すべて`auth.uid()`（今ログインしているユーザーのID）を前提にしている。つまり、**ログイン機能がなければ、非公開データの保護そのものが機能しない**。今回の実装は、前回作った「箱(DB)」に初めて「鍵(ログイン)」を取り付ける工程にあたる。

---

## 3. 設計思想・アーキテクチャの考え方

（このプロジェクトには数式は出てこないため、この章は「なぜこの設計にしたか」という考え方の説明に読み替えている）

### 3.1 「ログイン状態」をContextで共有する理由

トップページ以外にも、今後「ジャンル管理」「記録作成」など複数の画面でログイン状態(誰がログイン中か)を使う。もし各画面ごとに個別にSupabaseへ問い合わせていたら、コードが重複し、どこかの画面だけ更新漏れが起きるリスクがある。

Reactの`Context`は、アプリの一番外側で1回だけ「今の状態」を管理し、内側のどのコンポーネントからも`useAuth()`という1行で同じ情報を取り出せるようにする仕組みである。今回はこれ以上複雑な状態管理(Redux等の外部ライブラリ)は不要と判断し、Reactの標準機能のみで済ませている。

### 3.2 `onAuthStateChange`というリスナーの必要性

ログイン直後や、ブラウザタブを開き直した直後など、「今ログインしているかどうか」は勝手に変化する。`AuthContext`では、起動時に一度`getSession()`で現在の状態を取得しつつ、`onAuthStateChange`というリスナーを登録し、ログイン・ログアウト・トークン更新が起きるたびに自動で状態を更新している。これにより、画面のどこかで「ログアウト」ボタンを押した瞬間、他の画面も含めて即座に「未ログイン」表示に切り替わる。

### 3.3 「宣言的」なリダイレクトの選び方

ログインしていない状態で`/`にアクセスしたときの誘導は、`useEffect`の中で`navigate('/login')`を呼ぶ書き方(命令的)ではなく、`<Navigate to="/login" replace />`というコンポーネントを描画する書き方(宣言的)にした。React Routerの標準的な作法であり、「今の状態に応じてどの画面を描画するか」をJSXの中だけで完結させられるため、`useEffect`の実行タイミングを気にする必要がなくなる。

### 3.4 メール確認(Confirm email)まわりの実地での学び

Supabaseの新規登録では、初期設定で「確認メールのリンクを踏むまでログインできない」仕様になっている。この確認メールのリンクは、開発中は`http://localhost:5173`（開発者のPC自身）に戻ってくるよう作られる。**スマホなど別の端末でこのリンクを開くと、`localhost`はその端末自身を指してしまうため、確認ページに辿り着けない。**

これは実際にこのプロジェクトの動作確認中に発生した問題であり、次の2つの対処で解決した。

1. （応急処置）SupabaseのSQL Editorで`update auth.users set email_confirmed_at = now() where email = '...'`を実行し、手動で確認済みにする。
2. （開発中の運用）Supabaseダッシュボードの「Authentication → Sign In / Providers → Email」で「Confirm email」をオフにし、登録直後にそのままログインできるようにする。

本番公開前には②を再びオンに戻し、確認メールの戻り先URL(Site URL / Redirect URLs)を実際の公開ドメインに設定し直す必要がある。

---

## 4. 実装の考え方（コードとテーブル設計の対応）

| 概念 | コード上の対応 | 補足 |
|---|---|---|
| 今ログイン中かどうか | `AuthContext`の`user` / `loading` | `loading`中は「読み込み中...」を表示し、判定前にログイン画面へ誤誘導しない |
| ログイン状態の変化を検知 | `supabase.auth.onAuthStateChange(...)` | クリーンアップ関数で`unsubscribe()`し、画面が消えたあとも購読が残らないようにしている |
| 未ログイン時の誘導 | `HomePage`内の`<Navigate to="/login" replace />` | `replace`で履歴を汚さず、ブラウザの「戻る」でログイン前の画面に戻らないようにする |
| ログイン済みなのに`/login`に来た場合 | `LoginPage`内の`<Navigate to="/" replace />` | 二重にログイン画面を見せない |
| 表示名の保存 | `signUp`の`options.data.display_name` | [[supabase_schema_knowledge|前回]]の`handle_new_user()`トリガーが`profiles`テーブルへ自動コピーする |

### 主要な設計判断

- **判断**: 状態管理に外部ライブラリ(Redux, Zustand等)を使わず、React標準の`Context`のみを使った
  **理由**: 現時点で共有したい状態は「ログイン中のユーザー」1つだけであり、新しい依存関係を増やすメリットが薄い
  **他の選択肢**: 将来、共有したい状態(通知・テーマ設定等)が増えてきたら再検討する

- **判断**: ログイン/新規登録を別ページにせず、`LoginPage`内のタブ切り替えにした
  **理由**: フォームの見た目・入力項目(メール・パスワード)がほぼ共通で、画面遷移を増やすより1画面で完結させた方がシンプル

---

## 5. コードの読み方（ステップ・バイ・ステップ）

```tsx
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session)
    setLoading(false)
  })

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, newSession) => {
      setSession(newSession)
    },
  )

  return () => {
    listener.subscription.unsubscribe()
  }
}, [])
```

`AuthContext`の心臓部。画面が最初に表示された瞬間に「今のログイン状態」を1回取得し(`getSession`)、その後は変化があるたびに`onAuthStateChange`が自動で教えてくれる。戻り値の関数(`return () => {...}`)は、このコンポーネントが画面から消えるときに実行され、リスナーの登録を解除する後片付けである。

```tsx
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { display_name: displayName || email.split('@')[0] },
  },
})
```

新規登録の呼び出し。`options.data`に入れた内容は、Supabase側で「ユーザーのメタデータ」として保存され、[[supabase_schema_knowledge|前回作成した]]`handle_new_user()`トリガーがここから`display_name`を読み取って`profiles`テーブルに保存する。表示名が未入力なら、メールアドレスの`@`より前の部分を仮の表示名にしている。

```tsx
if (!user) {
  return <Navigate to="/login" replace />
}
```

`HomePage`の入口部分。`user`が`null`（未ログイン）なら、画面本体を描画する代わりにこの1行が実行され、React Routerが自動で`/login`へ画面を切り替える。

---

## 6. 具体例で動きを追う

1. ユーザーが`/login`で「新規登録」タブを選び、表示名「たなか」・メール・パスワードを入力して送信する
   → `supabase.auth.signUp()`が呼ばれる。Confirm emailがオフの設定なら、この時点で即座にセッションが発行される
2. Supabase側で`auth.users`に1行追加される。同時に[[supabase_schema_knowledge|`handle_new_user()`トリガー]]が発火し、`profiles`に`display_name = 'たなか'`の行ができる
3. `AuthContext`の`onAuthStateChange`がこの変化を検知し、`session`が更新される
4. `user`が`null`でなくなったので、`LoginPage`は自身を描画する代わりに`<Navigate to="/" />`を返し、画面が`HomePage`に切り替わる
5. `HomePage`は`user.email`を使って「〇〇としてログイン中です」と表示する
6. 「ログアウト」ボタンを押すと`signOut()`が呼ばれ、`session`が`null`に戻り、`HomePage`は`<Navigate to="/login" />`を返して`/login`に戻る

---

## 7. つまずきやすいポイント・よくある誤解

- **確認メールのリンクは「開発機のlocalhost」に戻ってくる**：スマホ等、別端末でリンクを開くとエラーになる。開発中は「Confirm email」オフか、SQLでの手動確認で回避する（3.4節参照）。
- **`useAuth()`は`AuthProvider`の外側では使えない**：`App.tsx`で`<AuthProvider>`の外に置いたコンポーネントから`useAuth()`を呼ぶと、`createContext`の初期値`undefined`が返り、意図的にエラーを投げるようにしている。エラーが出たら「Providerで囲み忘れていないか」を疑う。
- **`Invalid login credentials`は原因が複数ある**：パスワード間違いだけでなく、「メール未確認のまま(`email_confirmed_at`が`null`)」でも似たエラーになりうる。ログインできないときは、まずSupabaseダッシュボードのUsers一覧で該当ユーザーの確認状態を見るとよい。

---

## 8. 確認問題

1. `onAuthStateChange`の戻り値をなぜ`useEffect`のクリーンアップ関数で`unsubscribe()`しているか説明せよ。
   - 解答例: コンポーネントが再描画・破棄されるたびに新しいリスナーが登録され続けると、リスナーが二重三重に増えてしまう(メモリリークや意図しない多重実行の原因)。画面が消えるときに確実に解除するため。
2. なぜ`HomePage`で`loading`の状態を用意し、`loading`中は`<Navigate>`を返さないようにしているか。
   - 解答例: 起動直後、Supabaseへの問い合わせが終わる前に一瞬`user === null`に見える瞬間がある。この間に`/login`へ飛ばしてしまうと、実際はログイン済みのユーザーまで毎回ログイン画面を経由することになるため。
3. 新規登録時の`display_name`が、なぜ`entries`テーブルではなく`profiles`テーブルに保存されるのか、[[supabase_schema_knowledge|前回のスキーマ]]をふまえて説明せよ。
   - 解答例: 表示名はユーザー自身に1つだけ紐づく情報であり、記録(`entries`)ごとに変わるものではないため。`handle_new_user()`トリガーが`auth.users`への新規登録をきっかけに`profiles`へ自動でコピーする設計にしている。

---

## 9. さらに学ぶために

- Supabase公式ドキュメント「Auth」「Managing user data」
- React公式ドキュメント「Context」「Passing Data Deeply with Context」
- React Router公式ドキュメント「Navigate」
