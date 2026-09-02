import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function HomePage() {
  const { user } = useAuth()

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="rf-muted text-sm">
        {user?.email} としてログイン中です。自分だけの評価軸で、あらゆるものを記録するアプリ。
      </p>
      <nav className="mt-6 flex flex-col gap-2">
        <Link to="/genres" className="rf-link text-sm underline">
          ジャンルを管理する
        </Link>
        <Link to="/entries/new" className="rf-link text-sm underline">
          記録を作成する
        </Link>
        <Link to="/entries" className="rf-link text-sm underline">
          記録一覧を見る
        </Link>
        <Link to="/public" className="rf-link text-sm underline">
          みんなの公開記録を見る
        </Link>
      </nav>
    </main>
  )
}

export default HomePage
