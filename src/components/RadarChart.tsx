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

// 軸ラベル用に外周にとっておく余白。ホームのヒーローで軸アイコンを
// 重ねて表示する際、この値を使って同じ座標系で位置を計算する
export const RADAR_LABEL_MARGIN = 36

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
  const maxRadius = center - RADAR_LABEL_MARGIN

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
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
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

      {showLabels && axes.map((axis, i) => {
        const label = pointAt(maxRadius + 16, i)
        const cos = Math.cos(angleForIndex(i))
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
        return (
          <text
            key={axis.name}
            x={label.x}
            y={label.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--rf-muted, #495057)"
            fontFamily="var(--rf-font-body, sans-serif)"
          >
            {axis.name}({axis.score})
          </text>
        )
      })}
    </svg>
  )
}

export default RadarChart
