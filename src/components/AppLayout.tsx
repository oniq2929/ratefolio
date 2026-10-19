import { useEffect, useRef, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import ThemeSwitcher from './ThemeSwitcher'
import AddToHomeGuide from './AddToHomeGuide'
import { shouldShowAddToHomeGuide } from '../lib/pwa'

function AppLayout() {
  const { signOut } = useAuth()
  const { theme } = useTheme()
  const headerRef = useRef<HTMLElement>(null)
  // iPhoneのブラウザで開いていて、まだホーム画面に追加していない人に一度だけ手順を案内する
  // (新規登録→メール確認→初回ログインの直後に表示されることになる)
  const [showGuide, setShowGuide] = useState(() => shouldShowAddToHomeGuide())

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
            <Link
              to="/profile"
              aria-label="プロフィール"
              className="ml-auto sm:hidden"
              style={{ color: 'var(--rf-header-muted)' }}
            >
              <UserRound size={20} />
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
            <Link
              to="/profile"
              className="hidden items-center gap-1 text-sm underline sm:flex"
              style={{ color: 'var(--rf-header-muted)' }}
            >
              <UserRound size={16} aria-hidden="true" />
              プロフィール
            </Link>
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
      {showGuide && <AddToHomeGuide onClose={() => setShowGuide(false)} />}
    </div>
  )
}

export default AppLayout
