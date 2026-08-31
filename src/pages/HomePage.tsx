import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function HomePage() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="text-sm text-neutral-500">読み込み中...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

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
        {user.email} としてログイン中です。自分だけの評価軸で、あらゆるものを記録するアプリ。準備中です。
      </p>
    </main>
  )
}

export default HomePage
