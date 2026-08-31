import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function RequireAuth() {
  const { user, loading } = useAuth()

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

  return <Outlet />
}

export default RequireAuth
