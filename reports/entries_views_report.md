---
title: "entries_views 報告書"
type: report
project: "Ratefolio"
created: "2026-10-19"
updated: "2026-10-19"
version: "v1.0"
tags:
  - type/report
  - "project/Ratefolio"
  - tech/react
  - tech/svg
related:
  - "[[entries_views_knowledge]]"
  - "[[entries_list_report]]"
  - "[[properties_report]]"
aliases:
  - "entries_views"
---

# entries_views 報告書

| 項目 | 内容 |
|---|---|
| 作成日 | 2026-10-19 |
| 対象コード | `src/pages/EntriesPage.tsx`, `src/lib/entryFields.ts`, `src/lib/csv.ts`, `src/components/FilterBuilder.tsx`, `src/components/EntriesTable.tsx`, `src/components/ScatterPlot.tsx`, `src/components/RegionMap.tsx`, `scripts/generate-maps.mjs`（コミット: ec381d4） |
| 作成者 | Claude Code |
| 版数 | v1.0 |

## 改訂履歴
| 版 | 日付 | 変更内容 |
|---|---|---|
| v1.0 | 2026-10-19 | 初版作成 |

---

## 1. 目的・対象読者

本報告書は、記録一覧に追加した詳細検索（Obsidian Bases風の条件指定）、表示切替（カード・表・散布図・地図）、およびCSV出力の実装内容を共有することを目的とする。対象読者は本プロジェクトの技術的な引き継ぎ先を想定する。

## 2. 背景

プロパティ機能（[[properties_report]]）の追加に伴い、次の要望を受けた。

- プロパティや評価軸を使って記録を検索したい。
- 評価軸を2つ選んで図を描きたい。
- 都道府県のプロパティがある場合、日本地図上でどの都道府県にどの記録があるかを見たい。ワイン用に世界地図も欲しい。
- 記録をCSVで出力したい。

## 3. 数学的・物理的な前提知識

- 地図投影: 世界地図にはNatural Earth図法を用いる。日本地図の元データ（jpn-atlas）は投影済みの平面座標であり、恒等変換（`geoIdentity`）でSVGパスに変換する。
- 形状の簡略化: Visvalingam法（三角形の面積が小さい頂点から削る方法、`topojson-simplify`）で、重要度上位5%の頂点を残す。
- 散布図の円の大きさ: 件数を$n$としたとき、半径を$r = 5 + 4\sqrt{n-1}$とする。面積が件数にほぼ比例するため、見た目の大きさと件数が対応する。
- 塗り分けの濃さ: 件数$c$、最大件数$c_{max}$に対し、アクセント色の混合率を$35 + 65 \cdot c / c_{max}$（%）とする。

## 4. 仕様

### 4.1 入力仕様

| 項目名 | 型 | 説明 | 制約 |
|---|---|---|---|
| ジャンル | 選択 | 対象ジャンル（すべて／1つ） | — |
| 検索条件 | `FilterCondition[]` | 項目・条件・値の組 | すべての条件をAND結合。値が空の条件は無視 |
| 表示方法 | `cards` / `table` / `scatter` / `map` | 一覧の表示形式 | 表示方法と条件はlocalStorageに保存 |
| 散布図の軸 | フィールドID×2 | 数値型の項目（評価軸・数値プロパティ） | 数値項目が2つ以上必要 |
| 地図の項目 | フィールドID | 都道府県型・国型のプロパティ | 該当プロパティが存在する場合のみ |

### 4.2 出力仕様

| 項目名 | 型 | 説明 |
|---|---|---|
| 表 | HTML table | 全項目を列とし、見出しタップで昇順・降順を切り替え |
| 散布図 | SVG | 同一座標の記録を件数付きの円に集約。タップで該当記録を一覧表示 |
| 地図 | SVG | 件数で塗り分け。地域または下部の件数チップのタップで該当記録を一覧表示 |
| CSV | text/csv | BOM付きUTF-8、CRLF改行。表示中の記録×全項目。ファイル名`ratefolio[-ジャンル名]-YYYY-MM-DD.csv` |

### 4.3 制約条件・前提条件

- 絞り込みはクライアント側で行う。対象は自分の記録のみ（`owner_id = 自分`で取得）。
- 世界地図は1:1億1千万縮尺のため、小国は形状を持たない。これらは件数一覧にのみ表示する。

## 5. 使用ライブラリ・実行環境情報

| 項目 | 内容 |
|---|---|
| 言語/バージョン | TypeScript 6.0 / React 19 |
| 主要ライブラリ | lucide-react : 1.41（アイコン）／開発時のみ: d3-geo : 3.1, topojson-client : 3.1, topojson-simplify, world-atlas : 2.0, jpn-atlas : 1.0, i18n-iso-countries : 7.14 |
| 実行環境 | ブラウザ（スマートフォン・PC） |
| 実行方法 | 地図データの再生成: `node scripts/generate-maps.mjs`（通常は生成済みJSONをそのまま使う） |

## 6. アルゴリズム

1. 自分の記録を取得し、選択中のジャンルで絞る（`genreEntries`）。
2. `buildEntryFields`で、基本項目（対象名・ジャンル・日付・タグ・コメント・公開設定）、記録に現れる評価軸、記録に現れるプロパティから項目一覧を作る。
3. `applyFilters`で全条件をANDで評価し、続いてキーワード検索・並び替えを適用する（`visibleEntries`）。
4. 表示方法に応じて描画する。散布図は座標ごとに記録を集約し、地図は項目の値ごとに件数を数えて塗り分ける。
5. CSV出力時は`visibleEntries`の各記録について全項目の`get`を呼び、エスケープしてCSV文字列を作る。

## 7. フローチャート

![記録一覧の処理フロー](../figures/entries_views_flowchart.svg)

## 8. 実装

| 関数/クラス | 役割 |
|---|---|
| `buildEntryFields` | 記録の集合から利用可能な項目（フィールド）の一覧を作る |
| `applyFilters` / `OPS_BY_KIND` | 項目の種類ごとの条件定義と、AND条件での絞り込み |
| `FilterBuilder` | 条件の追加・変更・削除UI（項目→値→条件の語順） |
| `EntriesTable` | 表形式の一覧。列見出しで並び替え（空の値は常に末尾） |
| `ScatterPlot` | 2つの数値項目による散布図。重なりを集約し、タップで詳細を表示 |
| `RegionMap` | 都道府県・国の塗り分け地図。地図データは`import()`で遅延読み込み |
| `buildCsv` / `downloadCsv` | CSV文字列の生成とダウンロード |
| `generate-maps.mjs` | 地図のTopoJSONをSVGパスに変換・簡略化してJSONに書き出す。沖縄の移設と小笠原諸島の除外も行う |

## 9. 出力結果

生成した地図データを用いたサンプル表示を示す（データはサンプル）。

![表示例](../figures/entries_views_result.svg)

ビルド結果では、地図データが本体とは別のファイルに分かれ、地図を開いたときのみ読み込まれることを確認した（`japanMap` 91.5KB / gzip 26.9KB、`worldMap` 122.8KB / gzip 44.8KB）。

## 10. 妥当性検証

| 検証項目 | 方法 | 結果 | 判定 |
|---|---|---|---|
| 型チェック・ビルド | `tsc -b` / `npm run build` | エラーなし。地図データは別チャンクに分割された | 合格 |
| 日本地図・世界地図の形状と配置 | 生成データをブラウザで描画し目視確認 | 沖縄が左上の枠内に表示され、本州が大きく表示された。国名の対応も正しい | 合格 |
| 他人の記録が一覧・CSVに混入しないか | コードレビュー（取得クエリは従来どおり`owner_id = 自分`） | 混入経路なし | 合格 |
| 絞り込み・散布図・地図・CSVの実データでの動作 | 未実施（ログインが必要なため、本報告書の作成時点では実データで操作していない） | — | 要実機確認 |
| CSVをExcelで開いたときの文字化け | 未実施 | — | 要確認 |

## 11. 既知の制限事項・今後の課題

- 条件はANDのみで、OR条件や条件のグループ化には未対応である。
- 保存できる表示設定は1つのみ（Obsidian Basesのように、名前付きの「ビュー」を複数保存する機能は未実装）。
- 地図は件数による塗り分けのみで、評価軸の平均点での塗り分けには未対応である。
- 世界地図は小縮尺のため、小国は地図上に表示されない（件数一覧には表示される）。
- 公開一覧（みんなの記録）には本機能を適用していない。

## 12. 総括

記録から値を取り出す「フィールド」を共通部品とし、詳細検索・表・散布図・地図・CSV出力を同じ仕組みの上に実装した。プロパティや評価軸が増えても、全機能が自動的に対応する。地図はビルド前に投影・簡略化した軽量なSVGパスデータを遅延読み込みする方式とし、初期表示の速度への影響を避けた。

## 13. 参考文献

- d3-geo / topojson-client / topojson-simplify（GitHub: d3, topojson）
- Natural Earth（world-atlas）、国土地理院「地球地図日本」（jpn-atlas）
- RFC 4180: Common Format and MIME Type for Comma-Separated Values (CSV) Files

---

## Appendix. コード実例

```ts
// src/lib/entryFields.ts（抜粋）
export function applyFilters(entries, fields, conditions) {
  const active = conditions
    .map((c) => ({ condition: c, field: fields.find((f) => f.id === c.fieldId) }))
    .filter((x) => Boolean(x.field))
  if (active.length === 0) return entries
  return entries.filter((entry) =>
    active.every(({ field, condition }) => matches(field, condition, entry)),
  )
}
```
