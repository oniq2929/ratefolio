import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EntryField, EntryWithScores } from '../lib/entryFields'

interface ScatterPlotProps {
  entries: EntryWithScores[]
  xField: EntryField
  yField: EntryField
}

const WIDTH = 360
const HEIGHT = 300
const PAD = { left: 40, right: 16, top: 16, bottom: 36 }

// 評価軸(や数値プロパティ)を2つ選び、横軸・縦軸にとって記録を点で並べる図。
// 評価は整数なので同じ位置に重なりやすい。重なった記録は1つの円にまとめ、
// 件数に応じて円を大きくする。円をタップすると、その位置の記録が下に一覧表示される
function ScatterPlot({ entries, xField, yField }: ScatterPlotProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const { groups, xRange, yRange } = useMemo(() => {
    const map = new Map<string, { x: number; y: number; entries: EntryWithScores[] }>()
    for (const entry of entries) {
      const x = Number(xField.get(entry))
      const y = Number(yField.get(entry))
      if (xField.get(entry) === undefined || yField.get(entry) === undefined) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      const key = `${x},${y}`
      const group = map.get(key) ?? { x, y, entries: [] }
      group.entries.push(entry)
      map.set(key, group)
    }
    const list = [...map.entries()].map(([key, g]) => ({ key, ...g }))
    const range = (values: number[]) => {
      if (values.length === 0) return [0, 1] as const
      let min = Math.min(...values)
      let max = Math.max(...values)
      // 評価軸は1から始まるので、目盛りを0か1始まりに揃えて見やすくする
      if (min > 0 && min <= 1) min = 0
      if (min === max) {
        min -= 1
        max += 1
      }
      return [min, max] as const
    }
    return {
      groups: list,
      xRange: range(list.map((g) => g.x)),
      yRange: range(list.map((g) => g.y)),
    }
  }, [entries, xField, yField])

  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const toX = (v: number) => PAD.left + ((v - xRange[0]) / (xRange[1] - xRange[0])) * plotW
  const toY = (v: number) => PAD.top + plotH - ((v - yRange[0]) / (yRange[1] - yRange[0])) * plotH

  const ticks = (range: readonly [number, number]) => {
    const span = range[1] - range[0]
    const step = span <= 10 ? 1 : Math.ceil(span / 5)
    const result: number[] = []
    for (let v = Math.ceil(range[0]); v <= range[1]; v += step) result.push(v)
    return result
  }

  const selected = groups.find((g) => g.key === selectedKey)
  const skipped = entries.length - groups.reduce((n, g) => n + g.entries.length, 0)

  if (groups.length === 0) {
    return (
      <p className="rf-muted text-sm">
        「{xField.label}」と「{yField.label}」の両方に値がある記録がありません。
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rf-surface rounded-2xl p-2">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${xField.label}と${yField.label}の散布図`}>
          {ticks(xRange).map((v) => (
            <g key={`x${v}`}>
              <line x1={toX(v)} x2={toX(v)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--rf-chart-grid)" />
              <text x={toX(v)} y={HEIGHT - PAD.bottom + 14} textAnchor="middle" fontSize="10" fill="var(--rf-muted)">
                {v}
              </text>
            </g>
          ))}
          {ticks(yRange).map((v) => (
            <g key={`y${v}`}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={toY(v)} y2={toY(v)} stroke="var(--rf-chart-grid)" />
              <text x={PAD.left - 6} y={toY(v) + 3} textAnchor="end" fontSize="10" fill="var(--rf-muted)">
                {v}
              </text>
            </g>
          ))}
          <text x={PAD.left + plotW / 2} y={HEIGHT - 4} textAnchor="middle" fontSize="11" fill="var(--rf-text)">
            {xField.label} →
          </text>
          <text
            x={10}
            y={PAD.top + plotH / 2}
            textAnchor="middle"
            fontSize="11"
            fill="var(--rf-text)"
            transform={`rotate(-90 10 ${PAD.top + plotH / 2})`}
          >
            {yField.label} →
          </text>

          {groups.map((g) => {
            const r = 5 + Math.sqrt(g.entries.length - 1) * 4
            const isSelected = g.key === selectedKey
            return (
              <g
                key={g.key}
                onClick={() => setSelectedKey(isSelected ? null : g.key)}
                style={{ cursor: 'pointer' }}
              >
                {/* 指でタップしやすいよう、見えない大きめの当たり判定を置く */}
                <circle cx={toX(g.x)} cy={toY(g.y)} r={Math.max(r, 14)} fill="transparent" />
                <circle
                  cx={toX(g.x)}
                  cy={toY(g.y)}
                  r={r}
                  fill="var(--rf-accent)"
                  fillOpacity={isSelected ? 0.95 : 0.6}
                  stroke={isSelected ? 'var(--rf-text)' : 'var(--rf-surface)'}
                  strokeWidth={1.5}
                />
                {g.entries.length > 1 && (
                  <text
                    x={toX(g.x)}
                    y={toY(g.y) + 3.5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="var(--rf-accent-contrast)"
                    pointerEvents="none"
                  >
                    {g.entries.length}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {skipped > 0 && (
        <p className="rf-muted text-xs">値が未入力の記録 {skipped} 件は図に含まれていません。</p>
      )}

      {selected ? (
        <div className="rf-surface rounded-2xl p-3 text-sm">
          <p className="rf-muted text-xs">
            {xField.label} {selected.x} ・ {yField.label} {selected.y}（{selected.entries.length}件）
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {selected.entries.map((entry) => (
              <li key={entry.id}>
                <Link to={`/entries/${entry.id}/edit`} className="rf-link underline">
                  {entry.target_name}
                </Link>
                <span className="rf-muted ml-2 text-xs">{entry.entry_date}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rf-muted text-xs">点をタップすると、その位置の記録が表示されます。</p>
      )}
    </div>
  )
}

export default ScatterPlot
