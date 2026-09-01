import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function AppLayout() {
  const { signOut } = useAuth()

  return (
    <div>
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-bold">
            Ratefolio
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm text-neutral-500 underline"
          >
            ログアウト
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}

export default AppLayout
