import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Beer,
  ChevronRight,
  Coffee,
  Droplet,
  FileText,
  FolderKanban,
  Heart,
  Leaf,
  Lightbulb,
  MessageCircle,
  PenLine,
  Smile,
  Soup,
  Sparkle,
  Trash2,
  Users,
  Wheat,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RadarChart, { radarMaxRadius, radarPointAt } from '../components/RadarChart'
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
// 正六角形だと図として単調なので高低差はつけるが、高い軸と低い軸が
// 交互に並ぶとギザギザして不自然になるため、低い軸は1箇所にまとめている
const HERO_SAMPLE_AXES = [
  { name: '満足度', score: 9.5 },
  { name: 'コスパ', score: 7 },
  { name: '使いやすさ', score: 9 },
  { name: 'また使いたい', score: 5.5 },
  { name: '見た目', score: 8 },
  { name: '独自性', score: 8.5 },
]
const HERO_SAMPLE_SCALE_MAX = 10
const HERO_SAMPLE_TOTAL = (
  HERO_SAMPLE_AXES.reduce((sum, axis) => sum + axis.score, 0) /
  HERO_SAMPLE_AXES.length
).toFixed(1)
const HERO_CHART_SIZE = 212

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
      {/* ヒーロー: 見出しをカード全幅で上に置き、レーダーチャートは
          その下に大きく表示する(見出しの折り返し数と、図の大きさを両立させるため) */}
      <div
        className="rf-surface relative overflow-hidden rounded-2xl p-5"
        style={{ containerType: 'inline-size' }}
      >
        <div
          className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full blur-2xl"
          style={{ background: 'var(--rf-accent-2)', opacity: 0.2 }}
          aria-hidden="true"
        />
        {/* 見出しは背面のイラスト/チャートより手前(z-10)に置き、
            間隔を詰めて多少重なっても文字が隠れないようにする */}
        <div className="relative z-10">
          {/* カードの実幅を基準に文字サイズを決め、19文字を1行で幅いっぱいに
              並べる。万一はみ出す場合は overflow-hidden で切り落とす */}
          <p
            className="rf-heading overflow-hidden leading-snug font-semibold tracking-tight whitespace-nowrap"
            style={{ fontSize: 'clamp(12px, 5.2cqw, 22px)' }}
          >
            綴るほど<span className="rf-accent">「好き」</span>の解像度が上がっていく
          </p>
          <p className="rf-muted mt-1 text-sm">自分だけの記録帳</p>
        </div>

        <div className="relative z-0 -mt-6 flex items-start gap-1">
          {/* 左側: スコアと、大きさをばらけさせた食べ物アイコン */}
          <div className="relative min-w-0 flex-1" style={{ height: HERO_CHART_SIZE }}>
            <div className="rf-chip mt-9 inline-flex items-baseline gap-0.5 rounded-xl px-2.5 py-1.5">
              <span className="rf-heading text-base font-bold">{HERO_SAMPLE_TOTAL}</span>
              <span className="text-xs opacity-70">/ {HERO_SAMPLE_SCALE_MAX}</span>
            </div>
            <Coffee
              size={30}
              className="absolute"
              style={{
                left: 62,
                top: 88,
                opacity: 0.55,
                transform: 'rotate(14deg)',
                color: 'var(--rf-accent)',
              }}
              aria-hidden="true"
            />
            <Soup
              size={38}
              className="absolute"
              style={{
                left: 0,
                top: 104,
                opacity: 0.72,
                transform: 'rotate(-13deg)',
                color: 'var(--rf-accent-2)',
              }}
              aria-hidden="true"
            />
            <Beer
              size={36}
              className="absolute"
              style={{
                left: 56,
                top: 150,
                opacity: 0.65,
                transform: 'rotate(-7deg)',
                color: 'var(--rf-accent-2)',
              }}
              aria-hidden="true"
            />
            <Wheat
              size={22}
              className="absolute"
              style={{
                left: 2,
                top: 184,
                opacity: 0.38,
                transform: 'rotate(12deg)',
                color: 'var(--rf-accent-2)',
              }}
              aria-hidden="true"
            />
            <Leaf
              size={22}
              className="absolute"
              style={{
                left: 78,
                top: 200,
                opacity: 0.45,
                transform: 'rotate(28deg)',
                color: 'var(--rf-success)',
              }}
              aria-hidden="true"
            />
          </div>
          {/* チャート外周の余白ぶんだけ左に寄せ、狭い画面でも左カラムの幅を確保する */}
          <div
            className="relative mt-5 -ml-4 flex-shrink-0"
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
              const point = radarPointAt(
                HERO_CHART_SIZE,
                HERO_SAMPLE_AXES.length,
                i,
                radarMaxRadius(HERO_CHART_SIZE, false) + 12,
              )
              return (
                <Icon
                  key={axis.name}
                  size={21}
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
