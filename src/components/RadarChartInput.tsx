import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

interface RadarChartInputAxis {
  id: string
  name: string
  score: number
}

interface RadarChartInputProps {
  axes: RadarChartInputAxis[]
  scaleMax: number
  size?: number
  onChange: (axisId: string, score: number) => void
}

const GRID_RING_RATIOS = [1 / 3, 2 / 3, 1]
const LABEL_MARGIN = 46

// チャート上の点を直接ドラッグしてスコアを入力できるレーダーチャート。
// 表示専用のRadarChartとは、当たり判定やドラッグ処理を持つ点が異なるため
// 別コンポーネントにしている。
function RadarChartInput({
  axes,
  scaleMax,
  size = 260,
  onChange,
}: RadarChartInputProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingAxisRef = useRef<string | null>(null)

  const center = size / 2
  const maxRadius = center - LABEL_MARGIN

  const angleForIndex = (index: number) =>
    -Math.PI / 2 + (index * 2 * Math.PI) / axes.length

  const pointAt = (radius: number, index: number) => {
    const angle = angleForIndex(index)
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  }

  const toPointsAttr = (points: { x: number; y: number }[]) =>
    points.map((p) => `${p.x},${p.y}`).join(' ')

  const dataPoints = axes.map((axis, i) =>
    pointAt((Math.max(0, axis.score) / scaleMax) * maxRadius, i),
  )

  // 画面上の座標を、SVG内部の座標系に変換する
  // (SVGは枠に合わせて拡大縮小されるため、単純な差分では計算できない)
  const toSvgPoint = (event: ReactPointerEvent) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const scale = size / rect.width
    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
    }
  }

  // ドラッグ位置を、その軸上のスコア(1〜scaleMax)に変換する
  const updateScoreFrom = (event: ReactPointerEvent, axisId: string) => {
    const point = toSvgPoint(event)
    if (!point) return

    const index = axes.findIndex((axis) => axis.id === axisId)
    if (index === -1) return

    // 中心からの距離を、その軸の向きへ投影して求める
    const angle = angleForIndex(index)
    const distance =
      (point.x - center) * Math.cos(angle) + (point.y - center) * Math.sin(angle)

    const ratio = Math.min(1, Math.max(0, distance / maxRadius))
    const score = Math.min(scaleMax, Math.max(1, Math.round(ratio * scaleMax)))
    onChange(axisId, score)
  }

  const handlePointerDown = (
    event: ReactPointerEvent,
    axisId: string,
  ) => {
    event.preventDefault()
    draggingAxisRef.current = axisId
    event.currentTarget.setPointerCapture(event.pointerId)
    updateScoreFrom(event, axisId)
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    const axisId = draggingAxisRef.current
    if (!axisId) return
    updateScoreFrom(event, axisId)
  }

  const handlePointerUp = () => {
    draggingAxisRef.current = null
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{
        display: 'block',
        maxWidth: size,
        overflow: 'visible',
        // ドラッグ中に画面がスクロールしてしまうのを防ぐ
        touchAction: 'none',
      }}
    >
      {GRID_RING_RATIOS.map((ratio) => (
        <polygon
          key={ratio}
          points={toPointsAttr(axes.map((_, i) => pointAt(maxRadius * ratio, i)))}
          fill="none"
          stroke="var(--rf-chart-grid, #d0d7de)"
          strokeWidth={1}
        />
      ))}

      {axes.map((axis, i) => {
        const outer = pointAt(maxRadius, i)
        return (
          <line
            key={axis.id}
            x1={center}
            y1={center}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--rf-chart-grid, #d0d7de)"
            strokeWidth={1}
          />
        )
      })}

      <polygon
        points={toPointsAttr(dataPoints)}
        fill="var(--rf-accent, #4c6ef5)"
        fillOpacity={0.35}
        stroke="var(--rf-accent, #4c6ef5)"
        strokeWidth={2}
      />

      {axes.map((axis, i) => {
        const outer = pointAt(maxRadius, i)
        const handle = dataPoints[i]
        return (
          <g key={axis.id}>
            {/* 軸線上のどこをタップしてもその位置のスコアになるよう、
                線に沿った太めの透明な当たり判定を敷いておく */}
            <line
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="transparent"
              strokeWidth={28}
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onPointerDown={(event) => handlePointerDown(event, axis.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            <circle
              cx={handle.x}
              cy={handle.y}
              r={7}
              fill="var(--rf-accent, #4c6ef5)"
              stroke="var(--rf-surface, #ffffff)"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onPointerDown={(event) => handlePointerDown(event, axis.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </g>
        )
      })}

      {axes.map((axis, i) => {
        const label = pointAt(maxRadius + 20, i)
        const cos = Math.cos(angleForIndex(i))
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
        return (
          <g key={axis.id}>
            <text
              x={label.x}
              y={label.y - 7}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={16}
              fill="var(--rf-muted, #495057)"
              fontFamily="var(--rf-font-body, sans-serif)"
            >
              {axis.name}
            </text>
            <text
              x={label.x}
              y={label.y + 11}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={20}
              fontWeight="600"
              fill="var(--rf-accent, #4c6ef5)"
              fontFamily="var(--rf-font-body, sans-serif)"
            >
              {axis.score}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default RadarChartInput
