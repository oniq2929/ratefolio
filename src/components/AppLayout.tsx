import { useEffect, useRef } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import ThemeSwitcher from './ThemeSwitcher'

function AppLayout() {
  const { signOut } = useAuth()
  const { theme } = useTheme()
  const headerRef = useRef<HTMLElement>(null)

  // ホーム画面に追加して起動したときのステータスバー色を、
  // 実際に描画されているヘッダーの背景色に合わせる
  // (CSS変数を直接読むと var(...) のまま返る場合があるため、
  //  描画後の要素から解決済みの色を取得している)
  useEffect(() => {
    if (!headerRef.current) return
    const color = window.getComputedStyle(headerRef.current).backgroundColor
    if (!color) return
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', color)
  }, [theme])

  return (
    <div>
      <header
        ref={headerRef}
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
