import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  {
    to: '/genres',
    title: 'ジャンルを管理する',
    description: '評価軸・スケールの作成/編集',
  },
  {
    to: '/entries/new',
    title: '記録を作成する',
    description: 'スコア入力とレーダーチャート',
  },
  {
    to: '/entries',
    title: '記録一覧を見る',
    description: '絞り込み・検索・並び替え',
  },
  {
    to: '/public',
    title: 'みんなの公開記録を見る',
    description: 'フィード / ランキング',
  },
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
      <p className="rf-heading text-2xl leading-snug font-medium text-balance">
        紡ぐほど<span className="rf-accent">「好き」</span>の解像度が上がっていく、
        <br className="hidden sm:block" />
        自分だけの記録帳。
      </p>
      <nav className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rf-surface flex flex-col gap-1 rounded-lg p-4 transition-opacity hover:opacity-80"
          >
            <span className="rf-heading text-base font-semibold">
              {item.title}
            </span>
            <span className="rf-muted text-xs">{item.description}</span>
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
