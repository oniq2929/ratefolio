---
title: "theme 説明書"
type: knowledge
project: "Ratefolio"
created: "2026-09-02"
updated: "2026-09-02"
version: "v1.0"
tags:
  - type/knowledge
  - "project/Ratefolio"
  - tech/css
  - tech/react
related:
  - "[[theme_report]]"
aliases:
  - "theme"
---

# theme 説明書

> 対象コード: `src/index.css`, `src/contexts/ThemeContext.tsx`, `src/components/ThemeSwitcher.tsx`, `src/components/AppLayout.tsx`, `src/components/RadarChart.tsx`, `index.html`
> 対象読者: 作成者本人（学習目的）
> 前提知識レベル: アプリ開発初心者（DB・SQL・Reactいずれも初めて）
> 記述方針: 専門用語は初出のたびにかみ砕いて説明する

---

## 0. この文書の読み方・前提知識

- CSSの「カスタムプロパティ(変数)」。`--rf-bg: #eee9db;`のように定義し、`var(--rf-bg)`でどこからでも参照できる。
- Tailwindの「任意の値」記法。`bg-[var(--rf-bg)]`のように書くと、Tailwindのクラスの中でCSS変数を使える。

### 用語集

| 用語 | 意味（平易な説明） | 初出章 |
|---|---|---|
| デザイントークン | 色・フォント等の「見た目の決定値」に名前を付けて管理する考え方。今回は`--rf-bg`等のCSS変数がこれにあたる | 3 |
| ちらつき(FOUC) | ページが読み込まれた瞬間に一瞬だけ違うテーマが見え、その後正しいテーマに切り替わる現象 | 3 |
| `data-*`属性 | HTML要素に自由に付けられる独自の属性。CSSの`[data-app-theme="..."]`という書き方で、その属性の値ごとにスタイルを変えられる | 3 |

---

## 1. このコードで何をするか（概要）

ユーザーが「Field Notes」「Radar Bright」「Soft Grid」という3つの配色・フォントの組み合わせ(テーマ)から好きなものを選べる機能である。選択内容はブラウザに保存され、次回訪問時も維持される。「Ratefolio」のロゴ文字だけは、どのテーマを選んでも同じフォントのまま変わらない。

---

## 2. 背景・なぜこれが必要か

主要機能が一通り完成したところで、見た目の作り込みを行うことになった。作成者向けに3つのデザイン案(モックアップ)を提示したところ、「1つに決めるのではなく、ユーザーが好きなものを選べるようにしたい」という要望があり、固定デザインではなく「テーマ切り替え機能」として実装することになった。あわせて、「Ratefolio」というブランド名の文字だけは、どのテーマでも一貫した見た目にしたいという要望も反映している。

---

## 3. 設計思想・アーキテクチャの考え方

### 3.1 なぜReactの状態ではなくCSS変数で色を管理するのか

色やフォントをReactのstateで持ち、各要素に`style={{ color: theme === 'a' ? '#111' : '#fff' }}`のように書いていくと、テーマが増えるたびに全コンポーネントの分岐が増えて破綻する。

今回は、色やフォントを**CSS変数(デザイントークン)**として1箇所(`index.css`)にまとめ、`<html>`要素の`data-app-theme`属性の値によって、どのCSS変数セットが有効になるかをCSS側だけで切り替えている。画面のコンポーネントは「`var(--rf-accent)`を使う」とだけ書けばよく、今どのテーマかを意識する必要がない。Tailwindの`bg-[var(--rf-surface)]`のような「任意の値」記法を使えば、Tailwindのユーティリティクラスの書き方をほぼ崩さずにこの仕組みを取り入れられる。

### 3.2 ちらつき(FOUC)を防ぐ、HTML側の初期化スクリプト

Reactアプリは、JavaScriptが読み込まれてから初めて画面を描画する。もしテーマの選択を「Reactが起動してから」反映していたら、ページを開いた瞬間は既定のテーマが一瞬見え、その直後に保存されていたテーマへ切り替わる「ちらつき」が発生する。

これを防ぐため、`index.html`の`<head>`に、Reactより先に実行される小さな`<script>`を置き、`localStorage`に保存されたテーマ名を読んで`<html data-app-theme="...">`をその場で設定している。CSSは`<html>`の属性を見てすぐに正しい色を適用するため、ちらつきが起きない。

### 3.3 ロゴだけを独立したフォント変数にする

見出しやテキストのフォントはテーマごとに変わる(`--rf-font-display`)が、「Ratefolio」というロゴ文字だけは`--rf-font-logo`という**テーマの外側(`:root`直下)で1回だけ定義した変数**を使っている。テーマ別のブロックではこの変数を上書きしないため、常に同じフォント(Fraunces)になる。ブランドの一貫性(ロゴ)と、画面ごとの個性(テーマ)を、変数のスコープを分けることで両立させている。

### 3.4 RadarChartをテーマに追従させる方法

`RadarChart`はSVGで図形を描画するコンポーネントで、色は`stroke`/`fill`という属性で指定する。これらの属性値にも、CSSの`var(--rf-accent, #4c6ef5)`のような記法がそのまま使える(カンマの後ろはCSS変数が見つからなかった場合の予備の色)。これにより、`RadarChart`自身はテーマの状態を一切知らなくても、描画されている場所の`data-app-theme`に応じて自動的に色が変わる。

---

## 4. 実装の考え方（コードと概念の対応）

| 概念 | コード上の対応 | 補足 |
|---|---|---|
| テーマごとの色・フォント定義 | `index.css`の`[data-app-theme="..."]`ブロック | 3セット(field-notes/radar-bright/soft-grid) |
| 選択状態の保持 | `ThemeContext`(Reactの状態) + `localStorage` | ブラウザ再訪問時も選択を復元 |
| 初期表示のちらつき防止 | `index.html`内の`<script>` | Reactの起動前に`data-app-theme`をセット |
| ロゴフォントの固定 | `--rf-font-logo`(`:root`直下でのみ定義) | テーマ別ブロックでは上書きしない |
| チャート色のテーマ追従 | `RadarChart`の`stroke`/`fill`に`var(--rf-accent, ...)` | コンポーネント自身はテーマを意識しない |

### 主要な設計判断

- **判断**: テーマの保存先を`localStorage`のみとし、Supabaseの`profiles`テーブルなどDB側には保存しない
  **理由**: 現時点では「同じブラウザで使い続ける」という前提で十分であり、複数端末間で見た目の好みを同期する必要性は薄いと判断した
  **他の選択肢**: 将来、複数端末で同じ見た目にしたい要望が出れば、`profiles`にカラムを追加してDBに保存する方式に切り替えられる

- **判断**: 色を自由に選べるカラーピッカーではなく、あらかじめ用意した3つのテーマから選ぶ方式にした
  **理由**: 自由な配色は組み合わせによって文字が読みにくくなる(コントラスト不足)リスクがある。あらかじめ調整済みの3案なら、どれを選んでも一定の見やすさが保証できる

---

## 5. コードの読み方（ステップ・バイ・ステップ）

```html
<script>
  (function () {
    var THEMES = ['field-notes', 'radar-bright', 'soft-grid']
    try {
      var stored = localStorage.getItem('ratefolio-theme')
      document.documentElement.setAttribute(
        'data-app-theme',
        THEMES.indexOf(stored) === -1 ? 'field-notes' : stored,
      )
    } catch (e) {
      document.documentElement.setAttribute('data-app-theme', 'field-notes')
    }
  })()
</script>
```

`index.html`内、Reactが起動する前に実行されるスクリプト。保存されたテーマ名が3つのうちのどれでもなければ(未保存・壊れたデータ等)、既定値`field-notes`にフォールバックする安全策を入れている。

```tsx
useEffect(() => {
  document.documentElement.setAttribute('data-app-theme', theme)
  window.localStorage.setItem(STORAGE_KEY, theme)
}, [theme])
```

`ThemeContext`側。`theme`というReactの状態が変わるたびに、同じ属性を再設定し、`localStorage`も更新する。HTML側の初期化スクリプトと、Reactの実行中の処理とで、同じ仕組み(属性のセット)を使っている点がポイントである。

```css
[data-app-theme="radar-bright"] {
  --rf-bg: #14171f;
  --rf-accent: #f2a93b;
  --rf-font-display: "Unbounded", sans-serif;
  /* ... */
}
```

`index.css`側。属性セレクタ`[data-app-theme="..."]`の中で変数を再定義するだけで、その変数を使っているすべての要素の見た目が一括で変わる。

---

## 6. 具体例で動きを追う

1. ページを初めて開く。`localStorage`に保存がないため、HTML側の初期化スクリプトが既定の`field-notes`をセットする
2. ヘッダーの「Radar Bright」ボタンを押す。`ThemeSwitcher`が`setTheme('radar-bright')`を呼ぶ
3. `ThemeContext`の`useEffect`が発火し、`<html data-app-theme="radar-bright">`に書き換わり、`localStorage`にも保存される
4. CSSの`[data-app-theme="radar-bright"]`ブロックが有効になり、`--rf-bg`等の値が一斉に変わる。Reactは1つの属性を書き換えただけで、個々のコンポーネントを再レンダリングする必要がない
5. 次にページを再読み込みすると、HTML側の初期化スクリプトが`localStorage`から`"radar-bright"`を読み取り、最初から正しいテーマで表示される

---

## 7. つまずきやすいポイント・よくある誤解

- **CSS変数に予備の値(フォールバック)を書き忘れると、想定外の場所で真っ黒/真っ白になる**：`var(--rf-accent, #4c6ef5)`のように、カンマの後ろに予備の色を必ず入れておくと、`data-app-theme`が付いていない環境(例えばこのアプリの外)でコンポーネントを使い回しても壊れにくい。
- **テーマの状態と、OSのライト/ダーク設定は別物**：このアプリのテーマ切り替えは、OSの設定(`prefers-color-scheme`)とは連動していない。3つのテーマのうち2つはライト、1つはダークだが、これはユーザーが明示的に選ぶものであり、自動では切り替わらない。
- **Reactのstateだけでテーマを管理すると、初回表示のちらつきを防げない**：3.2節の理由により、HTML側にも初期化処理が必要になる。

---

## 8. 確認問題

1. なぜテーマの色情報をReactのstate(JavaScriptの変数)ではなく、CSSのカスタムプロパティとして管理しているのか説明せよ。
   - 解答例: 色の分岐をコンポーネントごとに書くと管理が煩雑になるため。CSS変数として1箇所にまとめ、`data-app-theme`属性の値でCSS側だけで切り替えることで、コンポーネント側はテーマを意識せずに済む。
2. `index.html`にテーマ設定用の`<script>`を置く理由は何か。
   - 解答例: Reactの起動(≒画面の描画)より前に、保存済みのテーマを`<html>`要素へ反映しておかないと、一瞬だけ既定のテーマが見えてから切り替わる「ちらつき」が発生するため。
3. 「Ratefolio」のロゴ文字だけがテーマの影響を受けないのはなぜか、CSS変数のスコープの観点から説明せよ。
   - 解答例: ロゴ用のフォントは`:root`直下でのみ定義された`--rf-font-logo`という変数を参照しており、各テーマのブロック(`[data-app-theme="..."]`)ではこの変数を一切上書きしていないため、常に同じ値のままになる。

---

## 9. さらに学ぶために

- MDN「Using CSS custom properties (variables)」
- Tailwind CSS公式ドキュメント「Arbitrary values」
