import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'signup'

function translateError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません。'
  }
  if (message.includes('User already registered')) {
    return 'このメールアドレスは既に登録されています。'
  }
  return message
}

function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 既にログイン済みならログイン画面は不要なのでトップへ戻す
  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)
    setSubmitting(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setErrorMessage(translateError(error.message))
      } else {
        navigate('/')
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // display_nameはhandle_new_user()トリガーがprofilesテーブルへコピーする
          data: { display_name: displayName || email.split('@')[0] },
        },
      })
      if (error) {
        setErrorMessage(translateError(error.message))
      } else {
        setInfoMessage(
          '確認メールを送信しました。メール内のリンクを開いて登録を完了してください。',
        )
      }
    }

    setSubmitting(false)
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold">Ratefolio</h1>

      <div className="mt-6 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`rounded px-3 py-1 ${
            mode === 'login' ? 'bg-neutral-900 text-white' : 'bg-neutral-100'
          }`}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`rounded px-3 py-1 ${
            mode === 'signup' ? 'bg-neutral-900 text-white' : 'bg-neutral-100'
          }`}
        >
          新規登録
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        {mode === 'signup' && (
          <label className="flex flex-col gap-1 text-sm">
            表示名
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2"
              placeholder="例: たなか"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          パスワード
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        {infoMessage && (
          <p className="text-sm text-emerald-600">{infoMessage}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {mode === 'login' ? 'ログイン' : '登録する'}
        </button>
      </form>
    </main>
  )
}

export default LoginPage
