// プロパティ(都道府県・店・温度・純米/大吟醸…)に関する共通の定義と処理
import type { EntryProperty, GenreProperty, PropertyType } from '../types/database'
import countryList from '../data/countries.json'

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  text: 'テキスト',
  number: '数値',
  select: '選択肢',
  prefecture: '都道府県（日本地図）',
  country: '国（世界地図）',
}

export const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]

/** 地図で集計できる型 */
export const MAP_PROPERTY_TYPES: PropertyType[] = ['prefecture', 'country']

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

export const COUNTRIES: string[] = countryList

/** 型ごとの選択肢(自由入力の型ならnull) */
export function choicesFor(type: PropertyType, options: string[]): string[] | null {
  if (type === 'select') return options
  if (type === 'prefecture') return PREFECTURES
  if (type === 'country') return COUNTRIES
  return null
}

/** 入力欄の文字列 → 保存する値。空ならnull(保存しない) */
export function parsePropertyValue(type: PropertyType, raw: string): string | number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (type === 'number') {
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return trimmed
}

/**
 * 入力フォームで扱う1行分。現在のジャンル定義と、記録に保存済みの値を合わせたもの
 * (定義が削除された後も、保存済みの値は編集画面に残して消えないようにする)
 */
export interface PropertyField {
  key: string
  name: string
  type: PropertyType
  options: string[]
  raw: string
}

export function buildPropertyFields(
  definitions: GenreProperty[],
  saved: EntryProperty[] = [],
): PropertyField[] {
  const fields: PropertyField[] = [...definitions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((def) => {
      const savedValue = saved.find((p) => p.name === def.name)
      return {
        key: def.id,
        name: def.name,
        type: def.type,
        options: def.options,
        raw: savedValue ? String(savedValue.value) : '',
      }
    })
  for (const p of saved) {
    if (!fields.some((f) => f.name === p.name)) {
      fields.push({ key: `saved-${p.name}`, name: p.name, type: p.type, options: [], raw: String(p.value) })
    }
  }
  return fields
}

export function fieldsToEntryProperties(fields: PropertyField[]): EntryProperty[] {
  const result: EntryProperty[] = []
  for (const field of fields) {
    const value = parsePropertyValue(field.type, field.raw)
    if (value !== null) result.push({ name: field.name, type: field.type, value })
  }
  return result
}

/** 記録からプロパティ値を取り出す(未設定ならundefined) */
export function propertyValue(
  entry: { properties?: EntryProperty[] | null },
  name: string,
): string | number | undefined {
  return entry.properties?.find((p) => p.name === name)?.value
}
