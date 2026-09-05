import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Droplet,
  FileText,
  FolderKanban,
  Heart,
  Lightbulb,
  MessageCircle,
  PenLine,
  Smile,
  Sparkle,
  Trash2,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RadarChart, { RADAR_LABEL_MARGIN, radarPointAt } from '../components/RadarChart'
import type { Entry } from '../types/database'

// 使用頻度が高い順(記録一覧より、次に見る場所が多いもの)に並べる
const SECONDARY_NAV_ITEMS = [
  {
    to: '/entries',
    title: '記録一覧',
    description: '過去の記録を見る',
    icon: FileText,
  },
  {
    to: '/public',
    title: 'みんなの記録',
    description: '他の人の記録を見る',
    icon: Users,
  },
  {
    to: '/genres',
    title: 'ジャンル管理',
    description: 'カテゴリを整理する',
    icon: FolderKanban,
  },
]

// ホームのヒーロー部分に出す、レーダーチャートの見本用ダミーデータ
// (実際の記録データとは無関係。「多軸で評価するアプリ」だと一目で伝えるための例)
const HERO_SAMPLE_AXES = [
  { name: '満足度', score: 8.5 },
  { name: 'コスパ', score: 7 },
  { name: '使いやすさ', score: 9 },
  { name: 'また使いたい', score: 9.5 },
  { name: '見た目', score: 8 },
  { name: '独自性', score: 7.5 },
]
const HERO_SAMPLE_SCALE_MAX = 10
const HERO_SAMPLE_TOTAL = (
  HERO_SAMPLE_AXES.reduce((sum, axis) => sum + axis.score, 0) /
  HERO_SAMPLE_AXES.length
).toFixed(1)
const HERO_CHART_SIZE = 176

// 軸名の代わりに置く装飾アイコン。実際の評価軸とは対応していない見た目のみの飾り
const HERO_AXIS_ICONS = [Heart, Lightbulb, Droplet, Smile, MessageCircle, Sparkle]
const HERO_AXIS_ICON_COLORS = [
  'var(--rf-accent)',
  'var(--rf-accent-2)',
  'var(--rf-success)',
  'var(--rf-accent-2)',
  'var(--rf-danger)',
  'var(--rf-accent)',
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
      {/* ヒーロー: キャッチコピーと、実物のRadarChart(見本データ・ラベル非表示)を
          横並びにして、スクロールなしで「記録を作成する」まで届く高さに収める */}
      <div className="rf-surface relative overflow-hidden rounded-2xl p-5">
        <div
          className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full blur-2xl"
          style={{ background: 'var(--rf-accent-2)', opacity: 0.2 }}
          aria-hidden="true"
        />
        <span
          className="rf-chip absolute top-4 right-4 rounded-full px-2.5 py-1 text-sm font-bold"
          style={{ transform: 'rotate(-4deg)' }}
        >
          {HERO_SAMPLE_TOTAL}
        </span>

        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="rf-heading text-base leading-snug font-semibold tracking-tight">
              <span className="inline-block">綴るほど</span>
              <span className="inline-block">
                <span className="rf-accent">「好き」</span>の
              </span>
              <span className="inline-block">解像度が</span>
              <span className="inline-block">上がっていく</span>
            </p>
            <p className="rf-muted mt-1 text-xs">自分だけの記録帳</p>
          </div>

          <div
            className="relative flex-shrink-0"
            style={{ width: HERO_CHART_SIZE, height: HERO_CHART_SIZE }}
          >
            <RadarChart
              axes={HERO_SAMPLE_AXES}
              scaleMax={HERO_SAMPLE_SCALE_MAX}
              size={HERO_CHART_SIZE}
              showLabels={false}
            />
            {HERO_SAMPLE_AXES.map((axis, i) => {
              const Icon = HERO_AXIS_ICONS[i % HERO_AXIS_ICONS.length]
              const maxRadius = HERO_CHART_SIZE / 2 - RADAR_LABEL_MARGIN
              const point = radarPointAt(
                HERO_CHART_SIZE,
                HERO_SAMPLE_AXES.length,
                i,
                maxRadius + 15,
              )
              return (
                <Icon
                  key={axis.name}
                  size={14}
                  className="absolute"
                  style={{
                    left: point.x,
                    top: point.y,
                    transform: 'translate(-50%, -50%)',
                    color: HERO_AXIS_ICON_COLORS[i % HERO_AXIS_ICON_COLORS.length],
                  }}
                  aria-hidden="true"
                />
              )
            })}
          </div>
        </div>
      </div>

      <Link
        to="/entries/new"
        className="rf-btn-primary mt-6 flex items-center justify-center gap-2 rounded-full py-4 text-base font-semibold"
        style={{ background: 'linear-gradient(135deg, var(--rf-accent), var(--rf-accent-2))' }}
      >
        <PenLine size={18} aria-hidden="true" />
        記録を作成する
      </Link>

      <nav className="mt-4 grid grid-cols-3 gap-3">
        {SECONDARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="rf-surface flex flex-col gap-2 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <Icon size={18} className="rf-accent" aria-hidden="true" />
                <ChevronRight size={14} className="rf-muted" aria-hidden="true" />
              </div>
              <div>
                <p className="rf-heading text-sm font-semibold">{item.title}</p>
                <p className="rf-muted mt-0.5 text-[11px] leading-tight">
                  {item.description}
                </p>
              </div>
            </Link>
          )
        })}
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
                className="rf-surface flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
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
    </main>
  )
}

export default HomePage
