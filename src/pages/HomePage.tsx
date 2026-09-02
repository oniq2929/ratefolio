import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  {
    to: '/genres',
    title: 'ジャンルを管理する',
    description: '評価軸・スケールの作成/編集',
  },
  {
    to: '/entries/new',
    title: '記録を作成する',
    description: 'スコア入力とレーダーチャート',
  },
  {
    to: '/entries',
    title: '記録一覧を見る',
    description: '絞り込み・検索・並び替え',
  },
  {
    to: '/public',
    title: 'みんなの公開記録を見る',
    description: 'フィード / ランキング',
  },
]

function HomePage() {
  const { user } = useAuth()

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="rf-muted text-sm">
        {user?.email} としてログイン中です。自分だけの評価軸で、あらゆるものを記録するアプリ。
      </p>
      <nav className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rf-surface flex flex-col gap-1 rounded-lg p-4 transition-opacity hover:opacity-80"
          >
            <span className="rf-heading text-base font-semibold">
              {item.title}
            </span>
            <span className="rf-muted text-xs">{item.description}</span>
          </Link>
        ))}
      </nav>
    </main>
  )
}

export default HomePage
