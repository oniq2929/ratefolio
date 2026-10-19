// 記録一覧の「検索条件」「表の列」「散布図の軸」「CSVの列」で共通して使う、
// 記録の項目(フィールド)の定義。Obsidian Basesのように、どの項目でも同じ書き方で
// 絞り込み・表示できるようにするための土台。
import type { Entry, EntryScore, PropertyType } from '../types/database'
import { MAP_PROPERTY_TYPES, propertyValue } from './properties'

export type EntryWithScores = Entry & { entry_scores: EntryScore[] }

export type FieldKind = 'text' | 'number' | 'date' | 'choice'
type FieldValue = string | number | undefined

export interface EntryField {
  id: string
  label: string
  kind: FieldKind
  get: (entry: EntryWithScores) => FieldValue
  /** choice型の候補(記録に実際に入っている値から作る) */
  choices?: string[]
  /** プロパティ由来の項目なら、その型 */
  propertyType?: PropertyType
}

function axisScore(entry: EntryWithScores, axisName: string) {
  return entry.entry_scores.find((s) => s.axis_name === axisName)?.score
}

/** 記録の集合から、使える項目の一覧を作る */
export function buildEntryFields(entries: EntryWithScores[]): EntryField[] {
  const fields: EntryField[] = [
    { id: 'target_name', label: '対象名', kind: 'text', get: (e) => e.target_name },
    {
      id: 'genre_name',
      label: 'ジャンル',
      kind: 'choice',
      get: (e) => e.genre_name,
      choices: distinct(entries.map((e) => e.genre_name)),
    },
    { id: 'entry_date', label: '日付', kind: 'date', get: (e) => e.entry_date },
    { id: 'tags', label: 'タグ', kind: 'text', get: (e) => e.tags.join(', ') || undefined },
    { id: 'comment', label: 'コメント', kind: 'text', get: (e) => e.comment ?? undefined },
    {
      id: 'is_public',
      label: '公開設定',
      kind: 'choice',
      get: (e) => (e.is_public ? '公開' : '非公開'),
      choices: ['公開', '非公開'],
    },
  ]

  // 評価軸(記録に登場する軸名を、ジャンル内の並び順を保って集める)
  const axisNames = distinct(
    entries.flatMap((e) =>
      [...e.entry_scores].sort((a, b) => a.sort_order - b.sort_order).map((s) => s.axis_name),
    ),
    false,
  )
  for (const name of axisNames) {
    fields.push({ id: `axis:${name}`, label: name, kind: 'number', get: (e) => axisScore(e, name) })
  }

  // プロパティ
  const propertyTypes = new Map<string, PropertyType>()
  for (const entry of entries) {
    for (const p of entry.properties ?? []) {
      if (!propertyTypes.has(p.name)) propertyTypes.set(p.name, p.type)
    }
  }
  for (const [name, type] of propertyTypes) {
    const get = (e: EntryWithScores) => propertyValue(e, name)
    if (type === 'number') {
      fields.push({ id: `prop:${name}`, label: name, kind: 'number', get, propertyType: type })
    } else if (type === 'text') {
      fields.push({ id: `prop:${name}`, label: name, kind: 'text', get, propertyType: type })
    } else {
      fields.push({
        id: `prop:${name}`,
        label: name,
        kind: 'choice',
        get,
        propertyType: type,
        choices: distinct(entries.map((e) => get(e)).filter((v) => v !== undefined).map(String)),
      })
    }
  }

  return fields
}

function distinct(values: string[], sort = true) {
  const result = [...new Set(values)]
  return sort ? result.sort((a, b) => a.localeCompare(b, 'ja')) : result
}

export const mapFieldsOf = (fields: EntryField[]) =>
  fields.filter((f) => f.propertyType && MAP_PROPERTY_TYPES.includes(f.propertyType))

// ---------------- 絞り込み条件 ----------------

export type FilterOp =
  | 'contains'
  | 'not_contains'
  | 'is'
  | 'is_not'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'before'
  | 'after'
  | 'is_empty'
  | 'not_empty'

export const OPS_BY_KIND: Record<FieldKind, { op: FilterOp; label: string }[]> = {
  text: [
    { op: 'contains', label: 'を含む' },
    { op: 'not_contains', label: 'を含まない' },
    { op: 'is_empty', label: 'が空' },
    { op: 'not_empty', label: 'が空でない' },
  ],
  choice: [
    { op: 'is', label: 'が' },
    { op: 'is_not', label: 'が次以外' },
    { op: 'is_empty', label: 'が空' },
    { op: 'not_empty', label: 'が空でない' },
  ],
  number: [
    { op: 'gte', label: '≧' },
    { op: 'lte', label: '≦' },
    { op: 'eq', label: '＝' },
    { op: 'ne', label: '≠' },
    { op: 'gt', label: '＞' },
    { op: 'lt', label: '＜' },
    { op: 'is_empty', label: 'が空' },
    { op: 'not_empty', label: 'が空でない' },
  ],
  date: [
    { op: 'after', label: '以降' },
    { op: 'before', label: '以前' },
    { op: 'is', label: 'が' },
    { op: 'is_empty', label: 'が空' },
  ],
}

export const NO_VALUE_OPS: FilterOp[] = ['is_empty', 'not_empty']

export interface FilterCondition {
  id: string
  fieldId: string
  op: FilterOp
  value: string
}

function matches(field: EntryField, condition: FilterCondition, entry: EntryWithScores) {
  const raw = field.get(entry)
  const empty = raw === undefined || raw === ''
  if (condition.op === 'is_empty') return empty
  if (condition.op === 'not_empty') return !empty
  // 値が未入力の条件は、まだ組み立て途中とみなして無視する
  if (!condition.value.trim()) return true

  const value = condition.value.trim()
  const text = empty ? '' : String(raw).toLowerCase()
  const num = typeof raw === 'number' ? raw : Number(raw)
  const target = Number(value)

  switch (condition.op) {
    case 'contains':
      return text.includes(value.toLowerCase())
    case 'not_contains':
      return !text.includes(value.toLowerCase())
    case 'is':
      return !empty && String(raw) === value
    case 'is_not':
      return String(raw ?? '') !== value
    case 'before':
      return !empty && String(raw) <= value
    case 'after':
      return !empty && String(raw) >= value
  }

  if (empty || !Number.isFinite(num) || !Number.isFinite(target)) return false
  switch (condition.op) {
    case 'eq':
      return num === target
    case 'ne':
      return num !== target
    case 'gt':
      return num > target
    case 'gte':
      return num >= target
    case 'lt':
      return num < target
    case 'lte':
      return num <= target
  }
  return true
}

/** すべての条件を満たす(AND)記録だけを残す */
export function applyFilters(
  entries: EntryWithScores[],
  fields: EntryField[],
  conditions: FilterCondition[],
) {
  const active = conditions
    .map((c) => ({ condition: c, field: fields.find((f) => f.id === c.fieldId) }))
    .filter((x): x is { condition: FilterCondition; field: EntryField } => Boolean(x.field))
  if (active.length === 0) return entries
  return entries.filter((entry) => active.every(({ field, condition }) => matches(field, condition, entry)))
}

/** 表示用の値(空なら「-」) */
export function displayValue(field: EntryField, entry: EntryWithScores) {
  const value = field.get(entry)
  return value === undefined || value === '' ? '-' : String(value)
}
