# supabase_schema 説明書

> 対象コード: `supabase/migrations/0001_init.sql`
> 対象読者: 作成者本人（学習目的）
> 前提知識レベル: アプリ開発初心者（DB・SQL・Reactいずれも初めて）
> 記述方針: 専門用語は初出のたびにかみ砕いて説明する

---

## 0. この文書の読み方・前提知識

このコードを理解するために、最低限次の考え方を押さえておくとよい。

- 「テーブル」「行」「カラム」といったリレーショナルデータベース(RDB)の基本用語
- 「外部キー(FK)」で別テーブルの行を参照する、という考え方
- 今回のスキーマの心臓部である **Row Level Security (RLS)**

### 用語集

| 用語 | 意味（平易な説明） | 初出章 |
|---|---|---|
| テーブル | Excelのシートのようなもの。行(レコード)の集まり | 1 |
| 外部キー(FK) | あるテーブルの行が、別テーブルのどの行と紐づくかを表す参照 | 3 |
| RLS(Row Level Security) | 「この行は誰が読み書きしてよいか」をデータベース自身が強制する仕組み | 3 |
| ポリシー(policy) | RLSの具体的なルール(「ownerが自分の行だけ」など)を書いたもの | 3 |
| トリガー(trigger) | 「行が追加/更新された瞬間に自動で実行される処理」 | 4 |
| スナップショット | ある時点の値をコピーして別の場所に保存し、後から元が変わっても影響を受けないようにすること | 3 |

---

## 1. このコードで何をするか（概要）

Supabase(PostgreSQLベースのバックエンドサービス)上に、Ratefolioが必要とするテーブル一式(ユーザーの表示名・ジャンル・評価軸・記録・記録ごとのスコア)と、それぞれの行に対する読み書き権限のルール(RLS)、写真置き場(Storage)のアクセス制御を作成するSQLである。

---

## 2. 背景・なぜこれが必要か

Ratefolioは「レコード単位で公開/非公開を切り替えられる、個人の評価記録アプリ」である。CLAUDE.mdおよび引き継ぎ資料には次の要件が明記されている。

- 「非公開データが他ユーザーのクエリに絶対に混入しない設計にすること」
- 「レコード単位の公開/非公開はDBレベルのアクセス制御(RLS等)と連動させる」

つまり、**アプリ側(React)のコードにバグがあっても、データベース自身が非公開データの漏洩をブロックできる状態**を作る必要がある。これを実現する標準的な方法が、PostgreSQL(Supabase)のRow Level Securityである。

---

## 3. 設計思想・アーキテクチャの考え方

（このプロジェクトには数式は出てこないため、この章は「なぜこの設計にしたか」という考え方の説明に読み替えている）

### 3.1 RLSの直感的なイメージ

ふつうのアプリでは、「このユーザーのデータだけ返す」という条件を**アプリ側のコード**(例:`WHERE owner_id = ログイン中のユーザー`)で毎回書く。しかし、1箇所でも書き忘れると、他人の非公開データが漏れてしまう。

RLSは、この条件を**テーブル自身に埋め込む**。たとえるなら、「見せてはいけない行に、透明な鍵をかけてしまう」イメージである。アプリ側がどんなSQLを投げても、鍵が開いている行しか返ってこない。ミスの起きる場所を「アプリの書き忘れやすいコード」から「テーブル定義の1箇所」に集約できるのが最大の利点である。

### 3.2 「スナップショット」という設計判断

`genres`(ジャンル)と`axes`(評価軸)は、常にオーナー本人しか読み書きできないように設計した。他ユーザーが公開された記録を見るときも、この2つのテーブルには一切アクセスしない。

その代わり、`entries`(記録)を作成する瞬間に、ジャンル名・評価軸名・スケール(何段階評価か)を`entries`/`entry_scores`側に**コピー(スナップショット)**して保存している。

これには2つの理由がある。

1. **RLSがシンプルになる**：もし公開記録を表示するたびに`genres`/`axes`テーブルへ「この記録が公開なら読める」という条件付きポリシーを書くと、テーブルをまたいだ複雑な条件になり、書き間違いのリスクが上がる。スナップショットにすれば、`genres`/`axes`は「常にオーナー本人のみ」という一番単純なルールのままでよい。
2. **記録が過去の姿のまま残る**：あとでジャンル名や評価軸名を変更・削除しても、過去に書いた記録の表示は変わらない。日記的な記録アプリとして、この性質は自然である。

### 3.3 写真ストレージのアクセス制御

写真は`entries.photo_path`に「Supabase Storage上の場所(パス文字列)」だけを保存し、画像本体はStorageに置く(Base64埋め込みはしない、という引き継ぎ資料の方針に対応)。

Storageのアクセス制御(`storage.objects`へのポリシー)も、`entries`テーブルの`is_public`列を参照する形にしている。つまり「記録が見られる人だけ、その記録の写真も見られる」という条件が、常に`entries`テーブルの公開設定と1対1で連動する。二重管理にならないようにしている。

---

## 4. 実装の考え方（コードとテーブル設計の対応）

| 概念 | コード上の対応 | 補足 |
|---|---|---|
| 誰が見られるか(公開/非公開) | `entries.is_public`、各テーブルのRLSポリシー | 唯一の「公開判定の源」を`entries.is_public`に一元化 |
| n個の評価軸 | `axes`テーブル(genre_idで1対多) | ジャンルごとに軸の数は自由 |
| 評価軸ごとのスコア | `entry_scores`テーブル(entry_id × axis_idの多対多的な構造) | 1記録につき軸の数だけ行ができる |
| スケール可変(5段階/10段階など) | `genres.scale_max` (2〜10のcheck制約) | 作成時に`entries.scale_max`へスナップショット |
| タグ(複数・自由入力) | `entries.tags` (text配列) | 別テーブルにせず配列カラムで十分とした |

### 主要な設計判断

- **判断**: タグを`tags`テーブルに正規化せず、`entries.tags text[]`という配列カラムにした
  **理由**: タグはユーザーごとの自由入力で、他ユーザーと共有・統計する要件がないため、正規化のメリットが薄い。GINインデックスで検索性能も確保できる
  **他の選択肢**: `tags`/`entry_tags`のような正規化テーブル(将来「人気タグランキング」等を作るなら移行を検討)

- **判断**: `genre_id`/`axis_id`の外部キーは`on delete set null` / `on delete cascade`を使い分けた
  **理由**: ジャンルを消しても過去の記録(`entries`)は消えてほしくないので`set null`。一方、記録自体を消せば、その記録のスコア(`entry_scores`)は一緒に消えてよいので`cascade`

---

## 5. コードの読み方（ステップ・バイ・ステップ）

```sql
create table public.entries (
  ...
  owner_id uuid not null references auth.users (id) on delete cascade,
  genre_id uuid references public.genres (id) on delete set null,
  genre_name text not null,
  scale_max smallint not null,
  ...
  is_public boolean not null default false,
  ...
);
```

`entries`テーブルの骨格。`owner_id`は「誰の記録か」、`is_public`が「公開/非公開」の唯一のスイッチ。`genre_name`/`scale_max`が前述のスナップショット。

```sql
create policy "entries_select_own_or_public"
  on public.entries for select
  using (auth.uid() = owner_id or is_public = true);
```

RLSポリシーの核心部分。`auth.uid()`は「今ログインしているユーザーのID」をSupabaseが自動で埋めてくれる関数。「自分の記録」または「公開記録」のときだけ`true`になり、その行が結果に含まれる。それ以外の行(他人の非公開記録)は、存在しないのと同じ扱いになる。

```sql
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
```

写真置き場(Storage)のポリシー。「この写真ファイルのパスと一致する`entries`行が、自分のものか公開されているか」をその都度チェックしている。`entries`側の判定ロジックをそのまま再利用する形になっている。

---

## 6. 具体例で動きを追う

1. ユーザーA(`auth.uid() = 'A'`)が「蕎麦」ジャンル(5段階)を作り、評価軸「コシ」「出汁」を設定する
   → `genres`に1行、`axes`に2行、いずれも`owner_id`/`genre_id`経由でAのみアクセス可能
2. Aが蕎麦屋の記録を書く。`is_public = false`のまま保存
   → `entries`に1行(`genre_name = '蕎麦'`, `scale_max = 5`のスナップショット付き)、`entry_scores`に2行(コシ・出汁のスコア)
3. 別ユーザーB(`auth.uid() = 'B'`)がRatefolioの公開一覧を開く
   → `entries_select_own_or_public`ポリシーにより、Bからは`owner_id = 'A' and is_public = false`のこの行は**見えない**(SQL的にはそもそも結果に現れない)
4. Aが同じ記録を公開(`is_public = true`)に切り替える
   → 同じポリシーの`is_public = true`の条件が成立し、Bからもこの記録・スコア・写真が見えるようになる
5. Aが「蕎麦」ジャンルの評価軸名を「コシ→食感」に変更しても、手順2で保存済みの記録の`entry_scores.axis_name`は「コシ」のまま変わらない(スナップショットのため)

---

## 7. つまずきやすいポイント・よくある誤解

- **RLSは「有効化しただけ」では何も見えなくなる**：`enable row level security`した直後は、ポリシーが1つもなければ誰も(オーナー自身すら)行を読めなくなる。必ずポリシーとセットで考える。
- **`using`と`with check`の違い**：`using`は「既存の行を読める/対象にできるか」、`with check`は「これから書き込む内容が条件を満たすか」。更新(`update`)では両方書かないと、条件に合わない値への書き換えを防げない。
- **`auth.uid()`はSupabase Authでログインしているときだけ値を持つ**：ログインしていない匿名アクセスでは`null`になり、`auth.uid() = owner_id`は常に`false`になる(＝安全側に倒れる)。

---

## 8. 確認問題

1. なぜ`genres`/`axes`テーブルには「公開記録なら他人も読める」というポリシーを作らなかったのか説明せよ。
   - 解答例: スナップショットにより、公開記録の表示に`genres`/`axes`への参照が不要になるため。複雑な公開ポリシーを増やさずに済み、事故のリスクを減らせる。
2. `entries`の`is_public`を`false→true`に更新したとき、RLS的に何が変わるか。
   - 解答例: `entries_select_own_or_public`ポリシーの`is_public = true`の条件が成立するようになり、オーナー以外のユーザーからもその行(および紐づく`entry_scores`・写真)が見えるようになる。
3. `storage.objects`のポリシーが`entries.photo_path`とのJOINになっている理由は何か。
   - 解答例: 写真の公開/非公開判定を`entries.is_public`に一元化し、写真専用の別ルールを二重管理しないため。

---

## 9. さらに学ぶために

- Supabase公式ドキュメント「Row Level Security」
- PostgreSQL公式ドキュメント「5.9. Row Security Policies」
