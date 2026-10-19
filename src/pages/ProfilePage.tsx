import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, QrCode, Smartphone, Trash2, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ShareAppQr from '../components/ShareAppQr'
import AddToHomeGuide from '../components/AddToHomeGuide'
import { isIos, isStandalone } from '../lib/pwa'

const DISPLAY_NAME_MAX = 30
const PASSWORD_MIN = 8

// プロフィール(表示名・パスワード)の編集、アプリの共有、アカウント削除をまとめた設定画面
function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [savedDisplayName, setSavedDisplayName] = useState('')
  const [profileMessage, setProfileMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const name = data?.display_name ?? ''
        setDisplayName(name)
        setSavedDisplayName(name)
      })
  }, [user])

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return
    const trimmed = displayName.trim()
    if (!trimmed) {
      setProfileMessage({ ok: false, text: '表示名を入力してください。' })
      return
    }
    setSavingProfile(true)
    // RLS(profiles_update_own)により、自分の行しか更新できない
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)
    setSavingProfile(false)
    if (error) {
      setProfileMessage({ ok: false, text: error.message })
      return
    }
    setSavedDisplayName(trimmed)
    setDisplayName(trimmed)
    setProfileMessage({ ok: true, text: '表示名を保存しました。公開記録の投稿者名にも反映されます。' })
  }

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword.length < PASSWORD_MIN) {
      setPasswordMessage({ ok: false, text: `${PASSWORD_MIN}文字以上で入力してください。` })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      setPasswordMessage({ ok: false, text: error.message })
      return
    }
    setNewPassword('')
    setPasswordMessage({ ok: true, text: 'パスワードを変更しました。' })
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    const confirmed = window.confirm(
      'アカウントを削除しますか？ジャンル・記録・写真・計算式などすべてのデータが完全に削除され、元に戻せません。',
    )
    if (!confirmed) return

    // Storage上の写真はDBの削除連鎖に含まれないため、先に自分の写真だけを消しておく
    const { data: ownEntries } = await supabase
      .from('entries')
      .select('photo_path')
      .eq('owner_id', user.id)
      .not('photo_path', 'is', null)

    const photoPaths = (ownEntries ?? [])
      .map((entry) => entry.photo_path)
      .filter((path): path is string => Boolean(path))

    if (photoPaths.length > 0) {
      await supabase.storage.from('entry-photos').remove(photoPaths)
    }

    const { error } = await supabase.rpc('delete_own_account')
    if (error) {
      window.alert('アカウントの削除に失敗しました: ' + error.message)
      return
    }

    await signOut()
    navigate('/login')
  }

  const messageClass = (ok: boolean) => (ok ? 'rf-success text-xs' : 'rf-danger text-xs')

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="rf-heading text-2xl font-semibold">プロフィール</h1>

      <section className="rf-surface mt-6 rounded-2xl p-4">
        <h2 className="rf-heading flex items-center gap-2 text-sm font-semibold">
          <UserRound size={16} className="rf-accent" aria-hidden="true" />
          アカウント情報
        </h2>
        <form onSubmit={handleSaveProfile} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            表示名
            <input
              type="text"
              value={displayName}
              maxLength={DISPLAY_NAME_MAX}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rf-input rounded px-3 py-2"
            />
            <span className="rf-muted text-xs">公開記録の投稿者名として表示されます。</span>
          </label>
          <p className="text-sm">
            <span className="rf-muted">メールアドレス: </span>
            {user?.email}
          </p>
          {profileMessage && <p className={messageClass(profileMessage.ok)}>{profileMessage.text}</p>}
          <button
            type="submit"
            disabled={savingProfile || displayName.trim() === savedDisplayName}
            className="rf-btn-primary self-start rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            {savingProfile ? '保存中...' : '表示名を保存'}
          </button>
        </form>

        <form
          onSubmit={handleChangePassword}
          className="mt-5 flex flex-col gap-3 border-t pt-4"
          style={{ borderColor: 'var(--rf-border)' }}
        >
          <label className="flex flex-col gap-1 text-sm">
            新しいパスワード
            <input
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rf-input rounded px-3 py-2"
            />
            <span className="rf-muted text-xs">{PASSWORD_MIN}文字以上で入力してください。</span>
          </label>
          {passwordMessage && <p className={messageClass(passwordMessage.ok)}>{passwordMessage.text}</p>}
          <button
            type="submit"
            disabled={savingPassword || !newPassword}
            className="rf-input self-start rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            {savingPassword ? '変更中...' : 'パスワードを変更'}
          </button>
        </form>
      </section>

      <section className="rf-surface mt-4 rounded-2xl p-4">
        <h2 className="rf-heading flex items-center gap-2 text-sm font-semibold">
          <QrCode size={16} className="rf-accent" aria-hidden="true" />
          Ratefolioを友達に紹介
        </h2>
        <p className="rf-muted mt-1 text-xs">相手のスマホのカメラで読み取ってもらうと、すぐに開けます。</p>
        <div className="mt-4">
          <ShareAppQr />
        </div>
      </section>

      {isIos() && !isStandalone() && (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="rf-surface mt-4 flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm"
        >
          <Smartphone size={16} className="rf-accent" aria-hidden="true" />
          ホーム画面に追加する方法
          <ChevronRight size={16} className="rf-muted ml-auto" aria-hidden="true" />
        </button>
      )}

      <div className="mt-10">
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="rf-danger flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium"
          style={{
            background: 'color-mix(in srgb, var(--rf-danger) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--rf-danger) 25%, transparent)',
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          アカウントを削除する
          <ChevronRight size={16} className="ml-auto" aria-hidden="true" />
        </button>
      </div>

      {showGuide && <AddToHomeGuide onClose={() => setShowGuide(false)} />}
    </main>
  )
}

export default ProfilePage
