import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Download, LayoutGrid, Map as MapIcon, ScatterChart, SlidersHorizontal, Table } from 'lucide-react'
import RadarChart from '../components/RadarChart'
import FilterBuilder from '../components/FilterBuilder'
import EntriesTable from '../components/EntriesTable'
import ScatterPlot from '../components/ScatterPlot'
import RegionMap from '../components/RegionMap'
import {
  applyFilters,
  buildEntryFields,
  mapFieldsOf,
  type EntryWithScores,
  type FilterCondition,
} from '../lib/entryFields'
import { buildCsv, downloadCsv } from '../lib/csv'
import type { Axis, Formula, Genre } from '../types/database'

type GenreWithAxes = Genre & { axes: Axis[] }
type SortMode = 'date_desc' | 'date_asc' | 'axis_desc' | 'formula_desc'
type ViewMode = 'cards' | 'table' | 'scatter' | 'map'

const VIEW_MODES: { mode: ViewMode; label: string; icon: typeof Table }[] = [
  { mode: 'cards', label: 'カード', icon: LayoutGrid },
  { mode: 'table', label: '表', icon: Table },
  { mode: 'scatter', label: '散布図', icon: ScatterChart },
  { mode: 'map', label: '地図', icon: MapIcon },
]

// 表示方法と検索条件は、次に開いたときもそのまま使えるよう端末に覚えておく
const VIEW_STATE_KEY = 'rf-entries-view'

interface SavedViewState {
  viewMode?: ViewMode
  conditions?: FilterCondition[]
}

function loadViewState(): SavedViewState {
  try {
    return JSON.parse(localStorage.getItem(VIEW_STATE_KEY) ?? '{}') as SavedViewState
  } catch {
    return {}
  }
}

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
  // 読み込みが遅い原因を切り分けるための一時的な計測(原因が判明したら削除する)
  const [timings, setTimings] = useState<Record<string, string>>({})

  const [selectedGenreId, setSelectedGenreId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('date_desc')
  const [sortAxisId, setSortAxisId] = useState('')
  const [sortFormulaId, setSortFormulaId] = useState('')

  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewState().viewMode ?? 'cards')
  const [conditions, setConditions] = useState<FilterCondition[]>(
    () => loadViewState().conditions ?? [],
  )
  const [showFilters, setShowFilters] = useState(() => (loadViewState().conditions ?? []).length > 0)
  const [scatterXId, setScatterXId] = useState('')
  const [scatterYId, setScatterYId] = useState('')
  const [mapFieldId, setMapFieldId] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ viewMode, conditions }))
    } catch {
      // 保存できなくても表示には影響しない
    }
  }, [viewMode, conditions])

  useEffect(() => {
    if (!user) return

    const startedAt = performance.now()
    const elapsed = () => ((performance.now() - startedAt) / 1000).toFixed(1)

    // 3つのクエリはそれぞれ独立に反映する。まとめて待つと、
    // 一番遅いクエリが終わるまで一覧が表示されないため
    supabase
      .from('entries')
      .select('*, entry_scores(*)')
      .eq('owner_id', user.id)
      .order('entry_date', { ascending: false })
      .then(async ({ data, error }) => {
        if (error) {
          setErrorMessage(error.message)
          setLoading(false)
          return
        }

        const fetchedEntries = (data ?? []) as EntryWithScores[]
        setEntries(fetchedEntries)
        setLoading(false)
        setTimings((prev) => ({ ...prev, entries: elapsed() }))

        // 非公開バケットの写真は、期限付きの署名URLを発行して初めて表示できる
        const photoPaths = fetchedEntries
          .map((e) => e.photo_path)
          .filter((path): path is string => Boolean(path))

        if (photoPaths.length === 0) return

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
        setTimings((prev) => ({ ...prev, photoUrls: elapsed() }))
      })

    supabase
      .from('genres')
      .select('*, axes(*)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setErrorMessage(error.message)
          return
        }
        setGenres((data ?? []) as GenreWithAxes[])
        setTimings((prev) => ({ ...prev, genres: elapsed() }))
      })

    supabase
      .from('formulas')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setErrorMessage(error.message)
          return
        }
        setFormulas((data ?? []) as Formula[])
        setTimings((prev) => ({ ...prev, formulas: elapsed() }))
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

  const genreEntries = useMemo(
    () => (selectedGenreId ? entries.filter((e) => e.genre_id === selectedGenreId) : entries),
    [entries, selectedGenreId],
  )

  // 検索条件・表の列・散布図の軸に使える項目(評価軸やプロパティを含む)
  const fields = useMemo(() => buildEntryFields(genreEntries), [genreEntries])
  const numberFields = useMemo(() => fields.filter((f) => f.kind === 'number'), [fields])
  const mapFields = useMemo(() => mapFieldsOf(fields), [fields])

  const scatterX = numberFields.find((f) => f.id === scatterXId) ?? numberFields[0]
  const scatterY =
    numberFields.find((f) => f.id === scatterYId) ??
    numberFields.find((f) => f.id !== scatterX?.id) ??
    numberFields[0]
  const mapField = mapFields.find((f) => f.id === mapFieldId) ?? mapFields[0]

  const visibleEntries = useMemo(() => {
    let result = applyFilters(genreEntries, fields, conditions)

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
  }, [genreEntries, fields, conditions, keyword, sortMode, sortAxisId, sortFormulaId, formulas])

  const handleExportCsv = () => {
    const csv = buildCsv(visibleEntries, fields)
    const today = new Date().toISOString().slice(0, 10)
    const genrePart = selectedGenre ? `-${selectedGenre.name}` : ''
    downloadCsv(`ratefolio${genrePart}-${today}.csv`, csv)
  }

  const handleDeleteEntry = async (entry: EntryWithScores) => {
    const confirmed = window.confirm(
      `「${entry.target_name}」の記録を削除しますか？元に戻せません。`,
    )
    if (!confirmed) return

    if (entry.photo_path) {
      await supabase.storage.from('entry-photos').remove([entry.photo_path])
    }

    const { error } = await supabase.from('entries').delete().eq('id', entry.id)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
  }

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
        <p className="rf-muted text-sm">読み込み中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="rf-heading text-2xl font-semibold">記録一覧</h1>
        <Link
          to="/entries/new"
          className="rf-btn-primary rounded px-3 py-2 text-sm"
        >
          + 記録を作成
        </Link>
      </div>

      {errorMessage && <p className="rf-danger mt-4 text-sm">{errorMessage}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <label className="flex flex-col gap-1 text-sm">
          ジャンル
          <select
            value={selectedGenreId}
            onChange={(e) => handleGenreFilterChange(e.target.value)}
            className="rf-input rounded px-3 py-2"
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
            className="rf-input rounded px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          並び替え
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rf-input rounded px-3 py-2"
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
              className="rf-input rounded px-3 py-2"
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

      {selectedGenre && (
        <Link
          to={`/genres/${selectedGenre.id}/formulas`}
          className="rf-link mt-2 inline-block text-xs underline"
        >
          「{selectedGenre.name}」の計算式を管理する
        </Link>
      )}

      {/* 詳しい検索条件(Obsidian Basesのように、項目×条件を自由に組み合わせる) */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="rf-link flex items-center gap-1 text-sm underline"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          詳しい条件で絞り込む{conditions.length > 0 ? `（${conditions.length}件の条件）` : ''}
        </button>
        {showFilters && (
          <div className="rf-surface mt-2 rounded-2xl p-3">
            <p className="rf-muted mb-2 text-xs">
              すべての条件に当てはまる記録だけを表示します。評価軸やプロパティでも絞り込めます。
            </p>
            <FilterBuilder fields={fields} conditions={conditions} onChange={setConditions} />
          </div>
        )}
      </div>

      {/* 表示方法の切り替えとCSV出力 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--rf-chip-bg)' }}>
          {VIEW_MODES.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs"
              style={
                viewMode === mode
                  ? { background: 'var(--rf-accent)', color: 'var(--rf-accent-contrast)' }
                  : { color: 'var(--rf-chip-text)' }
              }
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={visibleEntries.length === 0}
          className="rf-link flex items-center gap-1 text-xs underline disabled:opacity-40"
        >
          <Download size={13} aria-hidden="true" />
          CSVで出力（{visibleEntries.length}件）
        </button>
      </div>

      {visibleEntries.length === 0 && (
        <p className="rf-muted mt-6 text-sm">条件に一致する記録がありません。</p>
      )}

      {/* 読み込み時間の内訳(遅さの原因を切り分けるための一時的な表示) */}
      {Object.keys(timings).length > 0 && (
        <p className="rf-muted rf-mono mt-4 text-[10px]">
          読み込み計測: 記録 {timings.entries ?? '-'}s / ジャンル{' '}
          {timings.genres ?? '-'}s / 計算式 {timings.formulas ?? '-'}s / 写真URL{' '}
          {timings.photoUrls ?? '-'}s
        </p>
      )}

      {viewMode === 'table' && visibleEntries.length > 0 && (
        <div className="mt-4">
          <EntriesTable entries={visibleEntries} fields={fields} />
        </div>
      )}

      {viewMode === 'scatter' && visibleEntries.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {numberFields.length < 2 || !scatterX || !scatterY ? (
            <p className="rf-muted text-sm">
              散布図には数値の項目（評価軸など）が2つ以上必要です。
            </p>
          ) : (
            <>
              <p className="rf-muted text-xs">
                評価軸が違うジャンルが混ざると比べにくいため、上でジャンルを1つ選ぶのがおすすめです。
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-1">
                  横軸
                  <select
                    value={scatterX.id}
                    onChange={(e) => setScatterXId(e.target.value)}
                    className="rf-input rounded px-2 py-1.5"
                  >
                    {numberFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  縦軸
                  <select
                    value={scatterY.id}
                    onChange={(e) => setScatterYId(e.target.value)}
                    className="rf-input rounded px-2 py-1.5"
                  >
                    {numberFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ScatterPlot entries={visibleEntries} xField={scatterX} yField={scatterY} />
            </>
          )}
        </div>
      )}

      {viewMode === 'map' && visibleEntries.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {!mapField ? (
            <p className="rf-muted text-sm">
              地図で見るには、ジャンルに「都道府県」または「国」型のプロパティを追加し、記録に入力してください。
              {selectedGenre && (
                <>
                  {' '}
                  <Link to={`/genres/${selectedGenre.id}/properties`} className="rf-link underline">
                    プロパティを設定する
                  </Link>
                </>
              )}
            </p>
          ) : (
            <>
              {mapFields.length > 1 && (
                <label className="flex items-center gap-1 text-sm">
                  地図にする項目
                  <select
                    value={mapField.id}
                    onChange={(e) => setMapFieldId(e.target.value)}
                    className="rf-input rounded px-2 py-1.5"
                  >
                    {mapFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <RegionMap entries={visibleEntries} field={mapField} />
            </>
          )}
        </div>
      )}

      {viewMode === 'cards' && (
      <ul className="mt-6 flex flex-col gap-4">
        {visibleEntries.map((entry) => {
          const sortedScores = [...entry.entry_scores].sort(
            (a, b) => a.sort_order - b.sort_order,
          )
          const photoUrl = entry.photo_path
            ? photoUrls[entry.photo_path]
            : undefined

          return (
            <li key={entry.id} className="rf-surface relative rounded-2xl p-4">
              {/* カードのどこをタップしても編集画面へ。削除ボタンだけは
                  このリンクより手前(z-20)に置いて、タップを奪われないようにする */}
              <Link
                to={`/entries/${entry.id}/edit`}
                aria-label={`${entry.target_name}を編集する`}
                className="absolute inset-0 z-10 rounded-2xl"
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="rf-heading truncate text-xl font-bold">
                    {entry.target_name}
                  </h2>
                  <p className="rf-muted mt-0.5 text-xs">
                    {entry.genre_name}
                    {entry.is_public ? '・公開' : '・非公開'}
                  </p>
                </div>
                <div className="relative z-20 flex flex-shrink-0 items-center gap-2">
                  <span className="rf-muted rf-mono text-xs">
                    {entry.entry_date}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry)}
                    className="rf-danger text-xs underline"
                  >
                    削除
                  </button>
                </div>
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
              {(entry.properties ?? []).length > 0 && (
                <p className="rf-muted mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {entry.properties.map((p) => (
                    <span key={p.name}>
                      {p.name}: <span style={{ color: 'var(--rf-text)' }}>{p.value}</span>
                    </span>
                  ))}
                </p>
              )}
              {entry.comment && <p className="mt-2 text-sm">{entry.comment}</p>}
              {sortMode === 'formula_desc' && sortFormulaId && (
                <p className="rf-accent rf-mono mt-2 text-xs font-semibold">
                  計算式スコア:{' '}
                  {scoreByFormula(
                    entry,
                    formulas.find((f) => f.id === sortFormulaId)?.weights ?? {},
                  )}
                </p>
              )}

              {/* 左に写真・右にチャート。写真がない場合もNo Imageの枠を置き、
                  チャートの位置が記録ごとにズレないようにする */}
              <div className="mt-3 flex items-center gap-3">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={entry.target_name}
                    loading="lazy"
                    className="aspect-square w-1/3 max-w-40 flex-shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="rf-muted flex aspect-square w-1/3 max-w-40 flex-shrink-0 items-center justify-center rounded-xl text-xs"
                    style={{ background: 'var(--rf-chip-bg)' }}
                  >
                    No Image
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <RadarChart
                    axes={sortedScores.map((s) => ({
                      name: s.axis_name,
                      score: s.score,
                    }))}
                    scaleMax={entry.scale_max}
                    size={210}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      )}
    </main>
  )
}

export default EntriesPage
