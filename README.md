# Ratefolio

ジャンルを自分で定義し、ジャンルごとに評価軸（コシ・出汁・蕎麦感…等）をn個自由に設定して、対象（店・本・旅行先・釣り場・駅など任意のもの）を評価・記録していく汎用サービス。

詳細な背景・仕様は `handoff-rating-log-app.md` を参照。

## 技術スタック

- フロントエンド: TypeScript + React + Vite（SPA）+ React Router
- スタイリング: Tailwind CSS
- バックエンド/DB: Supabase（PostgreSQL + Auth + Storage + Row Level Security）
- ホスティング: Vercel / Netlify（予定）

## 開発

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド
npm run lint     # Lint
```

Supabase接続には `.env` に環境変数の設定が必要です（`.env.example` 参照、未整備の場合は今後追加）。
