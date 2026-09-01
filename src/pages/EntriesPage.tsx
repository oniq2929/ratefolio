import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RadarChart from '../components/RadarChart'
import type { Axis, Entry, EntryScore, Formula, Genre } from '../types/database'

type EntryWithScores = Entry & { entry_scores: EntryScore[] }
type GenreWithAxes = Genre & { axes: Axis[] }
type SortMode = 'date_desc' | 'date_asc' | 'axis_desc' | 'formula_desc'

function scoreByFormula(entry: EntryWithScores, weights: Record<string, number>) {
  return entry.entry_scores.reduce(
    (sum, s) => sum + (weights[s.axis_name] ?? 0) * s.score,
    0,
  )
}

function EntriesPage() {
  const { user } = useAuth()

  const [entries, setEntries] = useState<EntryWithScores[]>([])
  const [genres, setGenres] = useState<GenreWithAxes[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [selectedGenreId, setSelectedGenreId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('date_desc')
  const [sortAxisId, setSortAxisId] = useState('')
  const [sortFormulaId, setSortFormulaId] = useState('')

  useEffect(() => {
    if (!user) return

    Promise.all([
      supabase
        .from('entries')
        .select('*, entry_scores(*)')
        .eq('owner_id', user.id)
        .order('entry_date', { ascending: false }),
      supabase
        .from('genres')
        .select('*, axes(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('formulas')
        .select('*')
        .order('created_at', { ascending: false }),
    ]).then(async ([entriesRes, genresRes, formulasRes]) => {
      if (entriesRes.error) {
        setErrorMessage(entriesRes.error.message)
        setLoading(false)
        return
      }
      if (genresRes.error) {
        setErrorMessage(genresRes.error.message)
        setLoading(false)
        return
      }
      if (formulasRes.error) {
        setErrorMessage(formulasRes.error.message)
        setLoading(false)
        return
      }

      const fetchedEntries = (entriesRes.data ?? []) as EntryWithScores[]
      setEntries(fetchedEntries)
      setGenres((genresRes.data ?? []) as GenreWithAxes[])
      setFormulas((formulasRes.data ?? []) as Formula[])

      // 非公開バケットの写真は、期限付きの署名URLを発行して初めて表示できる
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

      setLoading(false)
    })
  }, [user])

  const selectedGenre = useMemo(
    () => genres.find((g) => g.id === selectedGenreId) ?? null,
    [genres, selectedGenreId],
  )

  const formulasForSelectedGenre = useMemo(
    () =>
      selectedGenre
        ? formulas.filter((f) => f.genre_name === selectedGenre.name)
        : [],
    [formulas, selectedGenre],
  )

  const visibleEntries = useMemo(() => {
    let result = entries

    if (selectedGenreId) {
      result = result.filter((entry) => entry.genre_id === selectedGenreId)
    }

    const trimmedKeyword = keyword.trim().toLowerCase()
    if (trimmedKeyword) {
      result = result.filter((entry) => {
        const haystack = [entry.target_name, entry.comment ?? '', ...entry.tags]
          .join(' ')
          .toLowerCase()
        return haystack.includes(trimmedKeyword)
      })
    }

    const sorted = [...result]
    if (sortMode === 'date_asc') {
      sorted.sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    } else if (sortMode === 'axis_desc' && sortAxisId) {
      const scoreOf = (entry: EntryWithScores) =>
        entry.entry_scores.find((s) => s.axis_id === sortAxisId)?.score ?? -1
      sorted.sort((a, b) => scoreOf(b) - scoreOf(a))
    } else if (sortMode === 'formula_desc' && sortFormulaId) {
      const formula = formulas.find((f) => f.id === sortFormulaId)
      if (formula) {
        sorted.sort(
          (a, b) =>
            scoreByFormula(b, formula.weights) -
            scoreByFormula(a, formula.weights),
        )
      }
    } else {
      sorted.sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    }

    return sorted
  }, [entries, selectedGenreId, keyword, sortMode, sortAxisId, sortFormulaId, formulas])

  const handleGenreFilterChange = (genreId: string) => {
    setSelectedGenreId(genreId)
    setSortAxisId('')
    setSortFormulaId('')
    if ((sortMode === 'axis_desc' || sortMode === 'formula_desc') && !genreId) {
      setSortMode('date_desc')
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-neutral-500">読み込み中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">記録一覧</h1>
        <Link
          to="/entries/new"
          className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
        >
          + 記録を作成
        </Link>
      </div>

      {errorMessage && (
        <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <label className="flex flex-col gap-1 text-sm">
          ジャンル
          <select
            value={selectedGenreId}
            onChange={(e) => handleGenreFilterChange(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="">すべて</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
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
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          並び替え
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="date_desc">日付が新しい順</option>
            <option value="date_asc">日付が古い順</option>
            <option value="axis_desc" disabled={!selectedGenre}>
              特定の評価軸が高い順(ジャンルを1つ選択時のみ)
            </option>
            <option
              value="formula_desc"
              disabled={!selectedGenre || formulasForSelectedGenre.length === 0}
            >
              カスタム評価式が高い順(ジャンルを1つ選択時のみ)
            </option>
          </select>
        </label>

        {sortMode === 'axis_desc' && selectedGenre && (
          <label className="flex flex-col gap-1 text-sm">
            評価軸
            <select
              value={sortAxisId}
              onChange={(e) => setSortAxisId(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2"
            >
              <option value="" disabled>
                選択してください
              </option>
              {[...selectedGenre.axes]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((axis) => (
                  <option key={axis.id} value={axis.id}>
                    {axis.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        {sortMode === 'formula_desc' && selectedGenre && (
          <label className="flex flex-col gap-1 text-sm">
            計算式
            <select
              value={sortFormulaId}
              onChange={(e) => setSortFormulaId(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2"
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

      {selectedGenre && (
        <Link
          to={`/genres/${selectedGenre.id}/formulas`}
          className="mt-2 inline-block text-xs text-blue-600 underline"
        >
          「{selectedGenre.name}」の計算式を管理する
        </Link>
      )}

      {visibleEntries.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          条件に一致する記録がありません。
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {visibleEntries.map((entry) => {
          const sortedScores = [...entry.entry_scores].sort(
            (a, b) => a.sort_order - b.sort_order,
          )
          const photoUrl = entry.photo_path
            ? photoUrls[entry.photo_path]
            : undefined

          return (
            <li
              key={entry.id}
              className="flex flex-col gap-4 rounded border border-neutral-200 p-4 sm:flex-row"
            >
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt={entry.target_name}
                  className="h-24 w-24 flex-shrink-0 rounded object-cover"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{entry.target_name}</h2>
                  <span className="text-xs text-neutral-500">
                    {entry.entry_date}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  {entry.genre_name}
                  {entry.is_public ? '・公開' : '・非公開'}
                </p>
                {entry.tags.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-600">
                    {entry.tags.map((tag) => `#${tag}`).join(' ')}
                  </p>
                )}
                {entry.comment && (
                  <p className="mt-1 text-sm text-neutral-700">
                    {entry.comment}
                  </p>
                )}
                {sortMode === 'formula_desc' && sortFormulaId && (
                  <p className="mt-1 text-xs font-semibold text-blue-600">
                    計算式スコア:{' '}
                    {scoreByFormula(
                      entry,
                      formulas.find((f) => f.id === sortFormulaId)?.weights ??
                        {},
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 justify-center">
                <RadarChart
                  axes={sortedScores.map((s) => ({
                    name: s.axis_name,
                    score: s.score,
                  }))}
                  scaleMax={entry.scale_max}
                  size={140}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

export default EntriesPage
