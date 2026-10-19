// 地図描画用のSVGパスデータを生成するスクリプト。
// 実行: node scripts/generate-maps.mjs
//
// 元データ(TopoJSON)をそのままブラウザで読み込むと、変換用ライブラリ(d3-geo等)と
// 大きな地図データを毎回ダウンロードすることになる。そこで、あらかじめ
// 「SVGの<path d="...">にそのまま入れられる文字列」に変換したJSONを
// src/data/ に書き出しておき、アプリ側はそれを表示するだけにする。
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { geoPath, geoIdentity, geoNaturalEarth1 } from 'd3-geo'
import { feature } from 'topojson-client'
import { presimplify, quantile, simplify } from 'topojson-simplify'
import countries from 'i18n-iso-countries'

const require = (path) => JSON.parse(readFileSync(new URL(`../node_modules/${path}`, import.meta.url)))
countries.registerLocale(JSON.parse(readFileSync(new URL('../node_modules/i18n-iso-countries/langs/ja.json', import.meta.url))))

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

// i18n-iso-countriesに無い地域(未承認国など)の日本語名
const EXTRA_COUNTRY_NAMES = {
  Kosovo: 'コソボ',
  'N. Cyprus': '北キプロス',
  Somaliland: 'ソマリランド',
}

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true })

// ---- 日本(都道府県) ----
// jpn-atlasは既に平面座標(SVG向け)に投影済みなので、座標はそのまま使う
{
  // 元データは細かすぎて重いため、重要度の高い上位5%の頂点だけ残して簡略化する
  const raw = presimplify(require('jpn-atlas/japan/japan.json'))
  const japan = simplify(raw, quantile(raw, 0.05))
  const prefectures = feature(japan, japan.objects.prefectures)
  const path = geoPath(geoIdentity()).digits(1)
  const boundsOf = (coordinates) => path.bounds({ type: 'Polygon', coordinates })

  // そのままだと小笠原諸島や沖縄まで含めた範囲になり、本州が小さく表示されてしまう。
  // そこで一般的な日本地図と同じく、
  //  - 東京都の小笠原諸島など、遠く離れた島は描かない
  //  - 沖縄県は左上の空いている場所(日本海側)に移して、枠で囲んで表示する
  const OKINAWA_SHIFT = [157, -490]
  for (const f of prefectures.features) {
    if (f.id === '13') {
      f.geometry.coordinates = f.geometry.coordinates.filter((poly) => {
        const [, [x1, y1]] = boundsOf(poly)
        return x1 <= 480 && y1 <= 360
      })
    }
    if (f.id === '47') {
      f.geometry.coordinates = f.geometry.coordinates.map((poly) =>
        poly.map((ring) => ring.map(([x, y]) => [x + OKINAWA_SHIFT[0], y + OKINAWA_SHIFT[1]])),
      )
    }
  }
  const okinawa = path.bounds(prefectures.features.find((f) => f.id === '47'))
  const inset = {
    x: Math.floor(okinawa[0][0] - 6),
    y: Math.floor(okinawa[0][1] - 6),
    width: Math.ceil(okinawa[1][0] - okinawa[0][0] + 12),
    height: Math.ceil(okinawa[1][1] - okinawa[0][1] + 12),
  }
  const [x0, y0, x1, y1] = path.bounds(prefectures).flat()
  const shapes = prefectures.features.map((f) => ({
    name: PREFECTURES[Number(f.id) - 1],
    d: path(f),
  }))
  const out = {
    viewBox: [Math.floor(x0) - 2, Math.floor(y0) - 2, Math.ceil(x1 - x0) + 4, Math.ceil(y1 - y0) + 4].join(' '),
    shapes,
    // 沖縄を移動したことが分かるよう、周りに描く枠
    insets: [inset],
  }
  writeFileSync(new URL('../src/data/japanMap.json', import.meta.url), JSON.stringify(out))
  console.log('japanMap.json', JSON.stringify(out).length, 'bytes')
}

// ---- 世界(国) ----
{
  const world = require('world-atlas/countries-110m.json')
  const land = feature(world, world.objects.countries)
  const width = 960
  const height = 500
  const projection = geoNaturalEarth1().fitSize([width, height], land)
  const path = geoPath(projection).digits(1)
  const shapes = land.features
    .map((f) => {
      const alpha2 = f.id ? countries.numericToAlpha2(f.id) : undefined
      const name =
        (alpha2 && countries.getName(alpha2, 'ja')) ?? EXTRA_COUNTRY_NAMES[f.properties.name]
      if (!name) console.warn('名前が見つからない国:', f.id, f.properties.name)
      return { name: name ?? f.properties.name, d: path(f) }
    })
    .filter((s) => s.d)
  const out = { viewBox: `0 0 ${width} ${height}`, shapes }
  writeFileSync(new URL('../src/data/worldMap.json', import.meta.url), JSON.stringify(out))
  console.log('worldMap.json', JSON.stringify(out).length, 'bytes')

  // 国の選択肢(地図に載らない小さな国も選べるよう、ISOの全リストから作る)
  const names = Object.values(countries.getNames('ja', { select: 'official' }))
  for (const extra of Object.values(EXTRA_COUNTRY_NAMES)) names.push(extra)
  const list = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ja'))
  writeFileSync(new URL('../src/data/countries.json', import.meta.url), JSON.stringify(list))
  console.log('countries.json', list.length, 'countries')
}
