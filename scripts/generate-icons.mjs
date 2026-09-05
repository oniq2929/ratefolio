// ============================================================
// Ratefolio のアプリアイコンを生成するスクリプト
//   実行: node scripts/generate-icons.mjs
//
// 画像編集ソフトを使わずに済むよう、PNGをNode.jsだけで組み立てている。
// (PNGは「画素データをzlibで圧縮し、決まった形式のチャンクに詰めたもの」なので、
//  標準搭載のzlibだけで作れる)
//
// 絵柄はアプリの中心機能であるレーダーチャートのモチーフ。
// iOSやAndroidはアイコンを角丸や円形に切り抜くため、図形は中央に寄せ、
// 背景は隅まで塗りつぶしている。
// ============================================================

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// --- 配色(Quiet Slateテーマのヘッダー色に合わせている) ---
const BG = [43, 46, 52]
const GRID = [74, 80, 88]
const FILL = [85, 112, 138]
const STROKE = [157, 192, 220]

// 見本スコア(0〜1)。ホーム画面のヒーローと同じ形にしている
const SCORES = [0.95, 0.7, 0.9, 0.55, 0.8, 0.85]

function hexagonAt(cx, cy, radius, index, count) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
}

function polygon(cx, cy, radius, count, scales) {
  return Array.from({ length: count }, (_, i) =>
    hexagonAt(cx, cy, radius * (scales ? scales[i] : 1), i, count),
  )
}

// 点が多角形の内側にあるか(レイキャスティング法)
function isInside(px, py, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function blend(base, over, alpha) {
  return base.map((c, i) => Math.round(c * (1 - alpha) + over[i] * alpha))
}

// 1辺sizeのアイコンを、SS倍に拡大して描いてから縮小する(輪郭を滑らかにするため)
function renderIcon(size) {
  const SS = 4
  const big = size * SS
  const cx = big / 2
  const cy = big / 2
  const radius = big * 0.33

  const gridOuter = polygon(cx, cy, radius, 6)
  const gridInner = polygon(cx, cy, radius * 0.94, 6)
  const gridMid = polygon(cx, cy, radius * 0.62, 6)
  const gridMidInner = polygon(cx, cy, radius * 0.56, 6)
  const data = polygon(cx, cy, radius, 6, SCORES)
  const dataInner = polygon(cx, cy, radius * 0.94, 6, SCORES)

  const hi = new Uint8Array(big * big * 3)
  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let color = BG

      if (isInside(px, py, gridOuter) && !isInside(px, py, gridInner)) {
        color = GRID
      } else if (isInside(px, py, gridMid) && !isInside(px, py, gridMidInner)) {
        color = GRID
      }

      if (isInside(px, py, data)) {
        color = isInside(px, py, dataInner) ? blend(color, FILL, 0.55) : STROKE
      }

      const offset = (y * big + x) * 3
      hi[offset] = color[0]
      hi[offset + 1] = color[1]
      hi[offset + 2] = color[2]
    }
  }

  // SS×SSの区画ごとに平均を取って縮小する
  const out = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sums = [0, 0, 0]
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const offset = ((y * SS + dy) * big + (x * SS + dx)) * 3
          sums[0] += hi[offset]
          sums[1] += hi[offset + 1]
          sums[2] += hi[offset + 2]
        }
      }
      const offset = (y * size + x) * 3
      const count = SS * SS
      out[offset] = Math.round(sums[0] / count)
      out[offset + 1] = Math.round(sums[1] / count)
      out[offset + 2] = Math.round(sums[2] / count)
    }
  }
  return out
}

// --- PNG組み立て ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function toPng(pixels, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // ビット深度
  ihdr[9] = 2 // カラータイプ2 = RGB
  // 10〜12 は圧縮方式・フィルタ方式・インターレース(すべて0)

  // 各行の先頭にフィルタ種別(0 = なし)を付ける
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1)
    raw[rowStart] = 0
    Buffer.from(pixels.subarray(y * size * 3, (y + 1) * size * 3)).copy(
      raw,
      rowStart + 1,
    )
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- 出力 ---
mkdirSync(outDir, { recursive: true })

for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  const png = toPng(renderIcon(size), size)
  writeFileSync(join(outDir, name), png)
  console.log(`${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)}KB)`)
}

// ブラウザのタブ用は、拡大しても劣化しないSVGで用意する
const points = (scales) =>
  polygon(256, 256, 256 * 0.66, 6, scales)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')

const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${rgb(BG)}"/>
  <polygon points="${points()}" fill="none" stroke="${rgb(GRID)}" stroke-width="14"/>
  <polygon points="${points(SCORES)}" fill="${rgb(FILL)}" fill-opacity="0.55" stroke="${rgb(STROKE)}" stroke-width="18" stroke-linejoin="round"/>
</svg>
`
writeFileSync(join(outDir, 'favicon.svg'), svg)
console.log('favicon.svg')
