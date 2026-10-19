---
title: "profile 報告書"
type: report
project: "Ratefolio"
created: "2026-10-19"
updated: "2026-10-19"
version: "v1.0"
tags:
  - type/report
  - "project/Ratefolio"
  - tech/react
  - tech/pwa
related:
  - "[[profile_knowledge]]"
  - "[[auth_report]]"
aliases:
  - "profile"
---

# profile 報告書

| 項目 | 内容 |
|---|---|
| 作成日 | 2026-10-19 |
| 対象コード | `src/pages/ProfilePage.tsx`, `src/components/ShareAppQr.tsx`, `src/components/AddToHomeGuide.tsx`, `src/lib/pwa.ts`, `src/components/AppLayout.tsx`, `src/pages/LoginPage.tsx`, `src/pages/HomePage.tsx`（コミット: 07abfc7） |
| 作成者 | Claude Code |
| 版数 | v1.0 |

## 改訂履歴
| 版 | 日付 | 変更内容 |
|---|---|---|
| v1.0 | 2026-10-19 | 初版作成 |

---

## 1. 目的・対象読者

本報告書は、プロフィール編集画面、アプリURLのQRコード共有、およびiPhone向けの「ホーム画面に追加」手順の案内の実装内容を共有することを目的とする。対象読者は本プロジェクトの技術的な引き継ぎ先を想定する。

## 2. 背景

利用者から次の要望を受けた。

- ユーザープロフィールを編集するタブが欲しい。
- QRコードでアプリをすぐ共有できるようにしたい（共有対象はアプリ自体のURL）。
- iPhoneでホーム画面に追加する手順を、登録時にポップアップで出したい。

iOSでは、Webアプリ側から「ホーム画面に追加」の操作を呼び出すAPIが提供されていない。そのため、操作手順を案内する方式とした。

## 3. 数学的・物理的な前提知識

本機能に数学的な前提知識はない。QRコードは誤り訂正レベルM（約15%の欠損まで復元可能）で生成する。

## 4. 仕様

### 4.1 入力仕様

| 項目名 | 型 | 説明 | 制約 |
|---|---|---|---|
| 表示名 | text | 公開記録の投稿者名 | 必須、30文字以内 |
| 新しいパスワード | text | ログイン用パスワード | 8文字以上 |
| 共有するURL | text | `window.location.origin` | 利用者は変更できない |
| 「次回から表示しない」 | boolean | ホーム追加案内の自動表示を止める | localStorageに保存（端末ごと） |

### 4.2 出力仕様

| 項目名 | 型 | 説明 |
|---|---|---|
| `profiles.display_name` | text | 更新後の表示名（RLSにより本人の行のみ更新可） |
| QRコード | PNG（data URL） | 480px、余白1、白地に黒 |
| ホーム追加案内 | モーダル | 3ステップの手順、「次回から表示しない」、閉じるボタン |

### 4.3 制約条件・前提条件

- 案内の自動表示は、iPhone／iPadかつホーム画面から起動していない場合に限る。
- 共有ボタンは`navigator.share`が利用できる環境でのみ表示する。
- QRコードの画像は`data:`スキームで表示するため、CSPの`img-src`に`data:`が含まれている必要がある（既存設定で許可済み）。

## 5. 使用ライブラリ・実行環境情報

| 項目 | 内容 |
|---|---|
| 言語/バージョン | TypeScript 6.0 / React 19 |
| 主要ライブラリ | qrcode : 1.5.4（QRコード生成、新規追加）／ @supabase/supabase-js : 2.112 ／ lucide-react : 1.41 |
| 実行環境 | ブラウザ（iOS Safari を主対象、他ブラウザでも動作） |
| 実行方法 | ヘッダーの「プロフィール」（スマホではアイコン）から開く |

## 6. アルゴリズム

ホーム追加案内の表示判定は次の順で行う。

1. ユーザーエージェントに`iPhone|iPad|iPod`を含む、または`Macintosh`かつ`maxTouchPoints > 1`であれば iOS と判定する。
2. `navigator.standalone === true` または `display-mode: standalone` に一致すれば、追加済みとして表示しない。
3. localStorageの`rf-a2hs-guide-dismissed`が`'1'`であれば表示しない。
4. 上記を満たす場合、新規登録成功時（LoginPage）およびログイン後の初回描画時（AppLayout）にモーダルを表示する。

QRコード共有は次の順で行う。

1. `window.location.origin`を取得する。
2. `QRCode.toDataURL`でPNGのdata URLを生成し、`<img>`に設定する。
3. 共有ボタンは`navigator.share`、コピーボタンは`navigator.clipboard.writeText`を呼ぶ。

## 7. フローチャート

![プロフィール・共有・ホーム追加案内の流れ](../figures/profile_flowchart.svg)

## 8. 実装

| 関数/クラス | 役割 |
|---|---|
| `ProfilePage` | 表示名・パスワードの変更、アプリ共有、ホーム追加案内の再表示、アカウント削除 |
| `ShareAppQr` | QRコード生成と共有・コピー |
| `AddToHomeGuide` | iPhone向けの追加手順のモーダル |
| `isIos` / `isStandalone` / `shouldShowAddToHomeGuide` / `dismissAddToHomeGuide` | 表示判定と非表示設定の保存 |
| `AppLayout` | ヘッダーにプロフィールへのリンクを追加。初回表示時の案内 |
| `LoginPage` | 新規登録成功時の案内 |
| `HomePage` | アカウント削除ボタンを削除し、プロフィールへのリンクに置換 |

## 9. 出力結果

プロフィール画面とホーム追加案内の画面構成を示す。

![画面構成](../figures/profile_result.svg)

## 10. 妥当性検証

| 検証項目 | 方法 | 結果 | 判定 |
|---|---|---|---|
| 型チェック・ビルド | `tsc -b` / `npm run build` | エラーなし | 合格 |
| ログイン画面の表示 | 開発サーバーで表示し、コンソールエラーを確認 | 正常表示、エラーなし | 合格 |
| 他人の表示名を変更できないか | 設計レビュー（`profiles_update_own`のRLSと`.eq('id', user.id)`） | 本人の行のみ更新可能 | 合格 |
| QRコードの読み取り | 未実施 | — | 要実機確認 |
| iPhoneでの案内の表示・非表示 | 未実施（iOS実機・ログインが必要） | — | 要実機確認 |
| ホーム画面から起動した場合に案内が出ないこと | 未実施 | — | 要実機確認 |

## 11. 既知の制限事項・今後の課題

- 案内の手順はSafariを前提としている。iOSのChrome等では共有ボタンの位置が異なる。
- 「表示しない」の設定は端末・ブラウザごとに保存されるため、別の端末では再度表示される。
- Androidでは`beforeinstallprompt`イベントによりアプリ内にインストールボタンを出せるが、今回は対応していない。
- プロフィール画像・自己紹介文など、表示名以外のプロフィール項目は未実装である。

## 12. 総括

プロフィール画面を新設し、表示名・パスワードの変更とアカウント削除を集約した。アプリのURLは端末内で生成したQRコードで共有でき、URLが外部に送信されることはない。iPhoneでは、新規登録時とログイン後の初回表示時に、ホーム画面への追加手順を案内するようにした。

## 13. 参考文献

- MDN Web Docs: Web Share API, Clipboard API, `display-mode`
- Apple Developer: Configuring Web Applications
- qrcode（npm）: https://www.npmjs.com/package/qrcode

---

## Appendix. コード実例

```ts
// src/lib/pwa.ts
export function shouldShowAddToHomeGuide() {
  if (!isIos() || isStandalone()) return false
  try {
    return localStorage.getItem(GUIDE_DISMISSED_KEY) !== '1'
  } catch {
    return true
  }
}
```
