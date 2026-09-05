import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ThemeSwitcher from './ThemeSwitcher'

function AppLayout() {
  const { signOut } = useAuth()

  return (
    <div>
      <header className="rf-surface border-b" style={{ borderColor: 'var(--rf-border)' }}>
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="rf-logo text-3xl font-semibold tracking-tight">
              Ratefolio
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="rf-muted text-sm underline sm:hidden"
            >
              ログアウト
            </button>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <button
              type="button"
              onClick={() => signOut()}
              className="rf-muted hidden text-sm underline sm:inline"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}

export default AppLayout
