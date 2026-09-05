type Point = { x: number; y: number }

// 正n角形の頂点座標を計算する(RadarChartと同じ考え方)
function polygonVertices(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotationDeg: number,
): Point[] {
  const rotation = (rotationDeg * Math.PI) / 180
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * 2 * Math.PI) / sides
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
}

function toPoints(vertices: Point[]): string {
  return vertices.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')
}

// 「多軸評価」という機能そのものをモチーフにした、装飾用の抽象グラフィック
function HeroGraphic() {
  const cx = 150
  const cy = 100

  const gridRings = [88, 60, 32].map((radius) =>
    toPoints(polygonVertices(cx, cy, radius, 6, -30)),
  )

  const shapeA = polygonVertices(cx + 18, cy - 6, 74, 5, 12)
  const shapeB = polygonVertices(cx - 10, cy + 4, 52, 6, -30)

  return (
    <svg
      viewBox="0 0 300 200"
      className="h-full w-full"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {gridRings.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="var(--rf-chart-grid, #d0d7de)"
          strokeWidth="1"
        />
      ))}

      <polygon
        points={toPoints(shapeA)}
        fill="var(--rf-accent-2, #3ed6c4)"
        fillOpacity="0.16"
        stroke="var(--rf-accent-2, #3ed6c4)"
        strokeWidth="1.5"
      />
      <polygon
        points={toPoints(shapeB)}
        fill="var(--rf-accent, #4c6ef5)"
        fillOpacity="0.3"
        stroke="var(--rf-accent, #4c6ef5)"
        strokeWidth="2"
      />

      {shapeB.map((v, i) => (
        <circle key={`b-${i}`} cx={v.x} cy={v.y} r={3.5} fill="var(--rf-accent, #4c6ef5)" />
      ))}
      {shapeA.map((v, i) => (
        <circle
          key={`a-${i}`}
          cx={v.x}
          cy={v.y}
          r={2.5}
          fill="var(--rf-accent-2, #3ed6c4)"
          fillOpacity="0.8"
        />
      ))}

      {/* 余白を埋める装飾の点 */}
      <circle cx="255" cy="35" r="3" fill="var(--rf-accent, #4c6ef5)" fillOpacity="0.4" />
      <circle cx="28" cy="155" r="2" fill="var(--rf-accent-2, #3ed6c4)" fillOpacity="0.5" />
      <circle cx="268" cy="150" r="2" fill="var(--rf-chart-grid, #d0d7de)" />
    </svg>
  )
}

export default HeroGraphic
