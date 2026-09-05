interface RadarChartAxis {
  name: string
  score: number
}

interface RadarChartProps {
  axes: RadarChartAxis[]
  scaleMax: number
  size?: number
  // ホームのヒーローのような小さい表示では、軸名の文字が窮屈になるため省略できるようにする
  showLabels?: boolean
}

// 目盛りとして薄く表示する同心多角形の、外周に対する半径の割合
const GRID_RING_RATIOS = [1 / 3, 2 / 3, 1]

// 外周にとっておく余白。軸名+スコアを2段で出すぶん、ラベルありのときは広めにとる
const LABEL_MARGIN = 46
const NO_LABEL_MARGIN = 20

// 多角形の外周半径。ホームのヒーローで軸アイコンを重ねる際にも使う
export function radarMaxRadius(size: number, showLabels: boolean) {
  return size / 2 - (showLabels ? LABEL_MARGIN : NO_LABEL_MARGIN)
}

// 中心・外周半径・軸数・何番目の軸かから、その頂点の座標を求める
// (RadarChart内部の計算と同じ考え方を、ホームのヒーローの軸アイコン配置にも使い回す)
export function radarPointAt(
  size: number,
  axisCount: number,
  index: number,
  radius: number,
) {
  const center = size / 2
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axisCount
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  }
}

function RadarChart({ axes, scaleMax, size = 260, showLabels = true }: RadarChartProps) {
  const center = size / 2
  const maxRadius = radarMaxRadius(size, showLabels)

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

  return (
    // sizeは内部の座標系。実際の表示幅は置かれた枠に合わせて縮み、
    // sizeを上限とする(枠が狭い画面でもレイアウトが崩れないようにするため)
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ display: 'block', maxWidth: size, overflow: 'visible' }}
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
            key={axis.name}
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

      {showLabels &&
        axes.map((axis, i) => {
          const label = pointAt(maxRadius + 20, i)
          const cos = Math.cos(angleForIndex(i))
          const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
          return (
            <g key={axis.name}>
              {/* 軸名とスコアを2段に分け、スコアを大きく強調する */}
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

export default RadarChart
