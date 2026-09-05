import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RadarChart from '../components/RadarChart'
import type { Entry, EntryScore, Formula } from '../types/database'

type PublicEntry = Entry & { entry_scores: EntryScore[] }
type ViewMode = 'feed' | 'ranking'
type RankingBasis = 'overall' | 'axis' | 'formula'

function scoreByFormula(entry: PublicEntry, weights: Record<string, number>) {
  return entry.entry_scores.reduce(
    (sum, s) => sum + (weights[s.axis_name] ?? 0) * s.score,
    0,
  )
}

function PublicPage() {
  const { user } = useAuth()

  const [entries, setEntries] = useState<PublicEntry[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('feed')
  const [selectedGenreName, setSelectedGenreName] = useState('')
  const [rankingBasis, setRankingBasis] = useState<RankingBasis>('overall')
  const [rankingAxisName, setRankingAxisName] = useState('')
  const [rankingFormulaId, setRankingFormulaId] = useState('')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    if (!user) return

    Promise.all([
      supabase
        .from('entries')
        .select('*, entry_scores(*)')
        .eq('is_public', true)
        .order('entry_date', { ascending: false }),
      // formulasはRLSにより常に自分の式のみ返る。自分の評価基準を
      // 他ユーザーの公開記録にも当てはめて並び替えるために使う
      supabase.from('formulas').select('*'),
    ]).then(async ([entriesRes, formulasRes]) => {
      if (entriesRes.error) {
        setErrorMessage(entriesRes.error.message)
        setLoading(false)
        return
      }
      if (formulasRes.error) {
        setErrorMessage(formulasRes.error.message)
        setLoading(false)
        return
      }

      const fetchedEntries = (entriesRes.data ?? []) as PublicEntry[]
      setEntries(fetchedEntries)
      setFormulas((formulasRes.data ?? []) as Formula[])

      const ownerIds = [...new Set(fetchedEntries.map((e) => e.owner_id))]
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ownerIds)
        if (profiles) {
          setAuthorNames(
            Object.fromEntries(profiles.map((p) => [p.id, p.display_name])),
          )
        }
      }

      // 写真URLの発行を待たずに一覧を表示し、写真は後から差し込む
      setLoading(false)

      const photoPaths = fetchedEntries
        .map((e) => e.photo_path)
        .filter((path): path is string => Boolean(path))
      if (photoPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from('entry-photos')
          .createSignedUrls(photoPaths, 60 * 60)
        if (signedUrls) {
          const urlMap: Record<string, string> = {}
          signedUrls.forEach((item) => {
            if (item.signedUrl && item.path) {
              urlMap[item.path] = item.signedUrl
            }
          })
          setPhotoUrls(urlMap)
        }
      }
    })
  }, [user])

  const genreNames = useMemo(
    () => [...new Set(entries.map((e) => e.genre_name))].sort(),
    [entries],
  )

  const axisNamesForSelectedGenre = useMemo(() => {
    if (!selectedGenreName) return []
    const names = new Set<string>()
    entries
      .filter((e) => e.genre_name === selectedGenreName)
      .forEach((e) => e.entry_scores.forEach((s) => names.add(s.axis_name)))
    return [...names].sort()
  }, [entries, selectedGenreName])

  const formulasForSelectedGenre = useMemo(
    () =>
      selectedGenreName
        ? formulas.filter((f) => f.genre_name === selectedGenreName)
        : [],
    [formulas, selectedGenreName],
  )

  // ランキングの並び替え基準。
  // - 'axis': 選んだ評価軸のスコアを正規化(0〜1)して比較
  // - 'formula': 自分のカスタム評価式(重み付き線形結合)の計算結果で比較
  // - 'overall': そのジャンル(または全ジャンル)の全軸平均を正規化(0〜1)して比較
  const rankScoreOf = (entry: PublicEntry): number => {
    if (rankingBasis === 'axis' && rankingAxisName) {
      const score = entry.entry_scores.find(
        (s) => s.axis_name === rankingAxisName,
      )?.score
      return score === undefined ? -1 : score / entry.scale_max
    }
    if (rankingBasis === 'formula' && rankingFormulaId) {
      const formula = formulas.find((f) => f.id === rankingFormulaId)
      return formula ? scoreByFormula(entry, formula.weights) : -Infinity
    }
    if (entry.entry_scores.length === 0) return -1
    const avg =
      entry.entry_scores.reduce((sum, s) => sum + s.score, 0) /
      entry.entry_scores.length
    return avg / entry.scale_max
  }

  const visibleEntries = useMemo(() => {
    let result = entries

    if (selectedGenreName) {
      result = result.filter((e) => e.genre_name === selectedGenreName)
    }

    const trimmedKeyword = keyword.trim().toLowerCase()
    if (trimmedKeyword) {
      result = result.filter((e) => {
        const haystack = [e.target_name, e.comment ?? '', ...e.tags]
          .join(' ')
          .toLowerCase()
        return haystack.includes(trimmedKeyword)
      })
    }

    const sorted = [...result]
    if (viewMode === 'ranking') {
      sorted.sort((a, b) => rankScoreOf(b) - rankScoreOf(a))
    } else {
      sorted.sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    }
    return sorted
  }, [
    entries,
    selectedGenreName,
    keyword,
    viewMode,
    rankingBasis,
    rankingAxisName,
    rankingFormulaId,
    formulas,
  ])

  const handleGenreFilterChange = (genreName: string) => {
    setSelectedGenreName(genreName)
    setRankingAxisName('')
    setRankingFormulaId('')
    if (!genreName && rankingBasis !== 'overall') {
      setRankingBasis('overall')
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="rf-muted text-sm">読み込み中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="rf-heading text-2xl font-semibold">みんなの公開記録</h1>

      {errorMessage && <p className="rf-danger mt-4 text-sm">{errorMessage}</p>}

      <div className="mt-6 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setViewMode('feed')}
          className="rounded px-3 py-1"
          style={
            viewMode === 'feed'
              ? { background: 'var(--rf-accent)', color: 'var(--rf-accent-contrast)' }
              : { background: 'var(--rf-chip-bg)', color: 'var(--rf-text)' }
          }
        >
          フィード
        </button>
        <button
          type="button"
          onClick={() => setViewMode('ranking')}
          className="rounded px-3 py-1"
          style={
            viewMode === 'ranking'
              ? { background: 'var(--rf-accent)', color: 'var(--rf-accent-contrast)' }
              : { background: 'var(--rf-chip-bg)', color: 'var(--rf-text)' }
          }
        >
          ランキング
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <label className="flex flex-col gap-1 text-sm">
          ジャンル
          <select
            value={selectedGenreName}
            onChange={(e) => handleGenreFilterChange(e.target.value)}
            className="rf-input rounded px-3 py-2"
          >
            <option value="">すべて</option>
            {genreNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          キーワード検索
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="対象名・コメント・タグ"
            className="rf-input rounded px-3 py-2"
          />
        </label>

        {viewMode === 'ranking' && (
          <label className="flex flex-col gap-1 text-sm">
            ランキング基準
            <select
              value={rankingBasis}
              onChange={(e) => {
                setRankingBasis(e.target.value as RankingBasis)
                setRankingAxisName('')
                setRankingFormulaId('')
              }}
              className="rf-input rounded px-3 py-2"
            >
              <option value="overall">全軸平均</option>
              <option value="axis" disabled={!selectedGenreName}>
                特定の評価軸(ジャンルを1つ選択時のみ)
              </option>
              <option
                value="formula"
                disabled={
                  !selectedGenreName || formulasForSelectedGenre.length === 0
                }
              >
                自分のカスタム評価式(ジャンルを1つ選択時のみ)
              </option>
            </select>
          </label>
        )}

        {viewMode === 'ranking' &&
          rankingBasis === 'axis' &&
          selectedGenreName && (
            <label className="flex flex-col gap-1 text-sm">
              評価軸
              <select
                value={rankingAxisName}
                onChange={(e) => setRankingAxisName(e.target.value)}
                className="rf-input rounded px-3 py-2"
              >
                <option value="" disabled>
                  選択してください
                </option>
                {axisNamesForSelectedGenre.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

        {viewMode === 'ranking' &&
          rankingBasis === 'formula' &&
          selectedGenreName && (
            <label className="flex flex-col gap-1 text-sm">
              計算式
              <select
                value={rankingFormulaId}
                onChange={(e) => setRankingFormulaId(e.target.value)}
                className="rf-input rounded px-3 py-2"
              >
                <option value="" disabled>
                  選択してください
                </option>
                {formulasForSelectedGenre.map((formula) => (
                  <option key={formula.id} value={formula.id}>
                    {formula.name}
                  </option>
                ))}
              </select>
            </label>
          )}
      </div>

      {visibleEntries.length === 0 && (
        <p className="rf-muted mt-6 text-sm">条件に一致する公開記録がありません。</p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {visibleEntries.map((entry, index) => {
          const sortedScores = [...entry.entry_scores].sort(
            (a, b) => a.sort_order - b.sort_order,
          )
          const photoUrl = entry.photo_path
            ? photoUrls[entry.photo_path]
            : undefined
          const score = rankScoreOf(entry)

          return (
            <li key={entry.id} className="rf-surface rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="rf-heading flex items-center gap-2 text-xl font-bold">
                    {viewMode === 'ranking' && (
                      <span className="rf-accent flex-shrink-0">
                        {index + 1}位
                      </span>
                    )}
                    <span className="truncate">{entry.target_name}</span>
                  </h2>
                  <p className="rf-muted mt-0.5 text-xs">
                    {entry.genre_name} ・{' '}
                    {authorNames[entry.owner_id] ?? '不明なユーザー'}
                  </p>
                </div>
                <span className="rf-muted rf-mono flex-shrink-0 text-xs">
                  {entry.entry_date}
                </span>
              </div>
              {entry.tags.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1 text-xs">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="rf-chip rounded-full px-2 py-0.5">
                      #{tag}
                    </span>
                  ))}
                </p>
              )}
              {entry.comment && <p className="mt-2 text-sm">{entry.comment}</p>}
              {viewMode === 'ranking' && rankingBasis === 'formula' && (
                <p className="rf-accent rf-mono mt-2 text-xs font-semibold">
                  計算式スコア: {score}
                </p>
              )}
              {viewMode === 'ranking' &&
                rankingBasis !== 'formula' &&
                score >= 0 && (
                  <p className="rf-accent rf-mono mt-2 text-xs font-semibold">
                    {rankingBasis === 'axis'
                      ? `${rankingAxisName}: ${Math.round(score * entry.scale_max)}/${entry.scale_max}`
                      : `総合: ${Math.round(score * 100)}%`}
                  </p>
                )}

              {/* 写真があれば左に写真・右にチャート、なければチャートを全幅で表示 */}
              <div className="mt-3 flex items-center gap-3">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt={entry.target_name}
                    loading="lazy"
                    className="aspect-square w-2/5 max-w-48 flex-shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <RadarChart
                    axes={sortedScores.map((s) => ({
                      name: s.axis_name,
                      score: s.score,
                    }))}
                    scaleMax={entry.scale_max}
                    size={260}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

export default PublicPage
