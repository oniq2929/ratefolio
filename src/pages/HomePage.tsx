import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// 使用頻度が高い順(記録一覧より、次に見る場所が多いもの)に並べる
const SECONDARY_NAV_ITEMS = [
  { to: '/entries', title: '記録一覧' },
  { to: '/public', title: 'みんなの記録' },
  { to: '/genres', title: 'ジャンル管理' },
]

function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

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

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="rf-heading text-2xl leading-snug font-medium">
        <span className="inline-block">紡ぐほど</span>
        <span className="inline-block">
          <span className="rf-accent">「好き」</span>の解像度が
        </span>
        <span className="inline-block">上がっていく、</span>
        <span className="inline-block">自分だけの記録帳。</span>
      </p>

      <Link
        to="/entries/new"
        className="rf-btn-primary mt-8 flex items-center justify-center rounded-lg py-4 text-base font-semibold transition-opacity hover:opacity-90"
      >
        + 記録を作成する
      </Link>

      <nav className="mt-4 grid grid-cols-3 gap-3">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rf-surface flex items-center justify-center rounded-lg p-3 text-center transition-opacity hover:opacity-80"
          >
            <span className="rf-heading text-sm font-semibold">
              {item.title}
            </span>
          </Link>
        ))}
      </nav>

      <div className="mt-10 border-t pt-4" style={{ borderColor: 'var(--rf-border)' }}>
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="rf-danger text-xs underline"
        >
          アカウントを削除する
        </button>
      </div>
    </main>
  )
}

export default HomePage
