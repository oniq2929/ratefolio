import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ThemeSwitcher from './ThemeSwitcher'

function AppLayout() {
  const { signOut } = useAuth()

  return (
    <div>
      <header
        className="border-b"
        style={{
          background: 'var(--rf-header-bg)',
          borderColor: 'var(--rf-header-border)',
          color: 'var(--rf-header-text)',
        }}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="rf-logo text-3xl font-semibold tracking-tight">
              Ratefolio
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm underline sm:hidden"
              style={{ color: 'var(--rf-header-muted)' }}
            >
              ログアウト
            </button>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <button
              type="button"
              onClick={() => signOut()}
              className="hidden text-sm underline sm:inline"
              style={{ color: 'var(--rf-header-muted)' }}
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
