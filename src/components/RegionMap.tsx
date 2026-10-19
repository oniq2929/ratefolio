import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EntryField, EntryWithScores } from '../lib/entryFields'

interface MapData {
  viewBox: string
  shapes: { name: string; d: string }[]
  /** 沖縄など、位置を移して表示している地域を囲む枠 */
  insets?: { x: number; y: number; width: number; height: number }[]
}

interface RegionMapProps {
  entries: EntryWithScores[]
  /** 都道府県型または国型のプロパティ */
  field: EntryField
}

// 地図データは大きいので、地図を開いたときに初めて読み込む(最初の画面表示を軽くするため)
const loaders = {
  prefecture: () => import('../data/japanMap.json').then((m) => m.default as MapData),
  country: () => import('../data/worldMap.json').then((m) => m.default as MapData),
}

// 都道府県(または国)ごとの記録件数で地図を塗り分ける。
// 地域をタップすると、そこに入っている記録が下に一覧表示される
function RegionMap({ entries, field }: RegionMapProps) {
  const kind = field.propertyType === 'country' ? 'country' : 'prefecture'
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setMapData(null)
    setSelectedRegion(null)
    loaders[kind]()
      .then((data) => active && setMapData(data))
      .catch(() => active && setLoadError(true))
    return () => {
      active = false
    }
  }, [kind])

  const byRegion = useMemo(() => {
    const map = new Map<string, EntryWithScores[]>()
    for (const entry of entries) {
      const value = field.get(entry)
      if (value === undefined || value === '') continue
      const list = map.get(String(value)) ?? []
      list.push(entry)
      map.set(String(value), list)
    }
    return map
  }, [entries, field])

  const maxCount = Math.max(1, ...[...byRegion.values()].map((l) => l.length))
  const ranking = [...byRegion.entries()].sort((a, b) => b[1].length - a[1].length)
  const selectedEntries = selectedRegion ? (byRegion.get(selectedRegion) ?? []) : []
  // 地図上に形がない地域(小さな島国など)は、地図では塗れないので一覧でのみ表示する
  const unmapped = mapData
    ? ranking.filter(([name]) => !mapData.shapes.some((s) => s.name === name))
    : []

  const fillFor = (name: string) => {
    const count = byRegion.get(name)?.length ?? 0
    if (count === 0) return 'var(--rf-chip-bg)'
    // 件数が多いほど濃いアクセント色にする(最少でも35%の濃さにして、1件でも見分けられるように)
    const ratio = 35 + Math.round((count / maxCount) * 65)
    return `color-mix(in srgb, var(--rf-accent) ${ratio}%, var(--rf-chip-bg))`
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rf-surface rounded-2xl p-2">
        {loadError && <p className="rf-danger p-4 text-sm">地図を読み込めませんでした。</p>}
        {!mapData && !loadError && <p className="rf-muted p-4 text-sm">地図を読み込み中...</p>}
        {mapData && (
          <svg viewBox={mapData.viewBox} className="w-full" role="img" aria-label={`${field.label}ごとの記録件数の地図`}>
            {mapData.shapes.map((shape) => {
              const count = byRegion.get(shape.name)?.length ?? 0
              const isSelected = shape.name === selectedRegion
              return (
                <path
                  key={shape.name}
                  d={shape.d}
                  style={{ fill: fillFor(shape.name), cursor: count > 0 ? 'pointer' : 'default' }}
                  stroke={isSelected ? 'var(--rf-text)' : 'var(--rf-surface)'}
                  strokeWidth={isSelected ? 1.6 : 0.5}
                  onClick={() => count > 0 && setSelectedRegion(isSelected ? null : shape.name)}
                >
                  <title>{`${shape.name}: ${count}件`}</title>
                </path>
              )
            })}
            {mapData.insets?.map((r) => (
              <rect
                key={`${r.x},${r.y}`}
                {...r}
                fill="none"
                stroke="var(--rf-border)"
                pointerEvents="none"
              />
            ))}
          </svg>
        )}
      </div>

      {ranking.length === 0 ? (
        <p className="rf-muted text-sm">「{field.label}」が入力された記録がありません。</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {ranking.map(([name, list]) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedRegion(name === selectedRegion ? null : name)}
              className="rounded-full px-2.5 py-1"
              style={
                name === selectedRegion
                  ? { background: 'var(--rf-accent)', color: 'var(--rf-accent-contrast)' }
                  : { background: 'var(--rf-chip-bg)', color: 'var(--rf-chip-text)' }
              }
            >
              {name} {list.length}
            </button>
          ))}
        </div>
      )}
      {unmapped.length > 0 && (
        <p className="rf-muted text-xs">
          {unmapped.map(([name]) => name).join('・')} は地図の縮尺では表示できないため、上の一覧からご覧ください。
        </p>
      )}

      {selectedRegion && (
        <div className="rf-surface rounded-2xl p-3 text-sm">
          <p className="rf-heading font-semibold">
            {selectedRegion}（{selectedEntries.length}件）
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {selectedEntries.map((entry) => (
              <li key={entry.id}>
                <Link to={`/entries/${entry.id}/edit`} className="rf-link underline">
                  {entry.target_name}
                </Link>
                <span className="rf-muted ml-2 text-xs">
                  {entry.genre_name}・{entry.entry_date}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default RegionMap
