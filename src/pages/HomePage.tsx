import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Entry } from '../types/database'

// 使用頻度が高い順(記録一覧より、次に見る場所が多いもの)に並べる
const SECONDARY_NAV_ITEMS = [
  { to: '/entries', title: '記録一覧' },
  { to: '/public', title: 'みんなの記録' },
  { to: '/genres', title: 'ジャンル管理' },
]

type RecentPublicEntry = Pick<
  Entry,
  'id' | 'target_name' | 'genre_name' | 'entry_date' | 'owner_id'
>

function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [recentEntries, setRecentEntries] = useState<RecentPublicEntry[]>([])
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})

  useEffect(() => {
    // 写真は取得せず必要最小限のみ問い合わせ、ホーム表示を軽く保つ
    supabase
      .from('entries')
      .select('id, target_name, genre_name, entry_date, owner_id')
      .eq('is_public', true)
      .order('entry_date', { ascending: false })
      .limit(5)
      .then(async ({ data, error }) => {
        if (error || !data) return
        setRecentEntries(data)

        const ownerIds = [...new Set(data.map((entry) => entry.owner_id))]
        if (ownerIds.length === 0) return

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ownerIds)
        if (profiles) {
          setAuthorNames(
            Object.fromEntries(profiles.map((p) => [p.id, p.display_name])),
          )
        }
      })
  }, [])

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
      <p className="rf-heading text-2xl leading-snug font-semibold tracking-tight">
        <span className="inline-block">紡ぐほど</span>
        <span className="inline-block">
          <span className="rf-accent">「好き」</span>の解像度が
        </span>
        <span className="inline-block">上がっていく、</span>
        <span className="inline-block">自分だけの記録帳。</span>
      </p>

      <Link
        to="/entries/new"
        className="rf-btn-primary mt-8 flex items-center justify-center rounded-xl py-4 text-base font-semibold"
      >
        + 記録を作成する
      </Link>

      <nav className="mt-4 grid grid-cols-3 gap-3">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rf-surface flex items-center justify-center rounded-xl p-3 text-center transition-transform hover:-translate-y-0.5"
          >
            <span className="rf-heading text-sm font-semibold">
              {item.title}
            </span>
          </Link>
        ))}
      </nav>

      {recentEntries.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="rf-heading text-sm font-semibold tracking-tight">
              最近の公開記録
            </h2>
            <Link to="/public" className="rf-link text-xs underline">
              もっと見る
            </Link>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {recentEntries.map((entry) => (
              <li
                key={entry.id}
                className="rf-surface flex items-center justify-between gap-3 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="rf-heading truncate text-sm font-semibold">
                    {entry.target_name}
                  </p>
                  <p className="rf-muted truncate text-xs">
                    {entry.genre_name} ・{' '}
                    {authorNames[entry.owner_id] ?? '不明なユーザー'}
                  </p>
                </div>
                <span className="rf-muted rf-mono flex-shrink-0 text-xs">
                  {entry.entry_date}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
