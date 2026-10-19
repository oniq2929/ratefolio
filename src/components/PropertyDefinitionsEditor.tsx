import { PROPERTY_TYPE_LABELS, PROPERTY_TYPES } from '../lib/properties'
import type { PropertyType } from '../types/database'

/** 編集中のプロパティ定義1行分。idは既存の定義を編集するときだけ持つ */
export interface PropertyDraft {
  key: string
  id?: string
  name: string
  type: PropertyType
  /** select型の選択肢(カンマ区切りで入力) */
  optionsInput: string
}

export function newPropertyDraft(name = '', type: PropertyType = 'text'): PropertyDraft {
  return { key: crypto.randomUUID(), name, type, optionsInput: '' }
}

export function parseOptions(input: string) {
  return [...new Set(input.split(/[,、]/).map((o) => o.trim()).filter(Boolean))]
}

/** 保存前のチェック。問題があればエラーメッセージを返す */
export function validatePropertyDrafts(drafts: PropertyDraft[]): string | null {
  const names = drafts.map((d) => d.name.trim())
  if (names.some((n) => !n)) return 'すべてのプロパティ名を入力してください。'
  if (new Set(names).size !== names.length) return 'プロパティ名が重複しています。'
  if (drafts.some((d) => d.type === 'select' && parseOptions(d.optionsInput).length === 0)) {
    return '「選択肢」型のプロパティには、選択肢を1つ以上入力してください。'
  }
  return null
}

// よく使うプロパティをワンタップで追加できるようにする
const PRESETS: { name: string; type: PropertyType }[] = [
  { name: '都道府県', type: 'prefecture' },
  { name: '国', type: 'country' },
  { name: '店', type: 'text' },
  { name: '価格', type: 'number' },
]

interface PropertyDefinitionsEditorProps {
  drafts: PropertyDraft[]
  onChange: (drafts: PropertyDraft[]) => void
}

function PropertyDefinitionsEditor({ drafts, onChange }: PropertyDefinitionsEditorProps) {
  const update = (key: string, patch: Partial<PropertyDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)))

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= drafts.length) return
    const next = [...drafts]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {drafts.map((draft, index) => (
        <div key={draft.key} className="rf-surface flex flex-col gap-2 rounded p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => update(draft.key, { name: e.target.value })}
              className="rf-input min-w-0 flex-1 rounded px-3 py-2 text-sm"
              placeholder="プロパティ名（例: 温度）"
            />
            <select
              value={draft.type}
              onChange={(e) => update(draft.key, { type: e.target.value as PropertyType })}
              className="rf-input rounded px-2 py-2 text-sm"
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROPERTY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          {draft.type === 'select' && (
            <input
              type="text"
              value={draft.optionsInput}
              onChange={(e) => update(draft.key, { optionsInput: e.target.value })}
              className="rf-input rounded px-3 py-2 text-sm"
              placeholder="選択肢をカンマ区切りで（例: 純米, 吟醸, 大吟醸）"
            />
          )}
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rf-link underline disabled:opacity-30">
              ↑ 上へ
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === drafts.length - 1}
              className="rf-link underline disabled:opacity-30"
            >
              ↓ 下へ
            </button>
            <button
              type="button"
              onClick={() => onChange(drafts.filter((d) => d.key !== draft.key))}
              className="rf-danger ml-auto underline"
            >
              削除
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => onChange([...drafts, newPropertyDraft()])}
          className="rf-input rounded px-3 py-1"
        >
          + プロパティを追加
        </button>
        {PRESETS.filter((p) => !drafts.some((d) => d.name.trim() === p.name)).map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => onChange([...drafts, newPropertyDraft(preset.name, preset.type)])}
            className="rf-chip rounded-full px-3 py-1 text-xs"
          >
            + {preset.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default PropertyDefinitionsEditor
