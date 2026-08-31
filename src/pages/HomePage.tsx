import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function HomePage() {
  const { user, signOut } = useAuth()

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ratefolio</h1>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm text-neutral-500 underline"
        >
          ログアウト
        </button>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        {user?.email} としてログイン中です。自分だけの評価軸で、あらゆるものを記録するアプリ。準備中です。
      </p>
      <nav className="mt-6 flex flex-col gap-2">
        <Link to="/genres" className="text-sm text-blue-600 underline">
          ジャンルを管理する
        </Link>
        <Link to="/entries/new" className="text-sm text-blue-600 underline">
          記録を作成する
        </Link>
      </nav>
    </main>
  )
}

export default HomePage
