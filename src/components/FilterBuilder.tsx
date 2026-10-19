import {
  NO_VALUE_OPS,
  OPS_BY_KIND,
  type EntryField,
  type FilterCondition,
} from '../lib/entryFields'

interface FilterBuilderProps {
  fields: EntryField[]
  conditions: FilterCondition[]
  onChange: (conditions: FilterCondition[]) => void
}

// 「項目」「条件」「値」を1行として、検索条件を自由に積み重ねられる入力欄
// (すべての条件を満たす記録だけが表示される)
function FilterBuilder({ fields, conditions, onChange }: FilterBuilderProps) {
  const update = (id: string, patch: Partial<FilterCondition>) =>
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const addCondition = () => {
    const field = fields[0]
    if (!field) return
    onChange([
      ...conditions,
      { id: crypto.randomUUID(), fieldId: field.id, op: OPS_BY_KIND[field.kind][0].op, value: '' },
    ])
  }

  return (
    <div className="flex flex-col gap-2">
      {conditions.map((condition) => {
        const field = fields.find((f) => f.id === condition.fieldId)
        const ops = field ? OPS_BY_KIND[field.kind] : []
        const needsValue = !NO_VALUE_OPS.includes(condition.op)

        return (
          <div key={condition.id} className="flex flex-wrap items-center gap-2 text-sm">
            <select
              value={condition.fieldId}
              onChange={(e) => {
                const next = fields.find((f) => f.id === e.target.value)
                if (!next) return
                update(condition.id, {
                  fieldId: next.id,
                  op: OPS_BY_KIND[next.kind][0].op,
                  value: '',
                })
              }}
              className="rf-input min-w-0 rounded px-2 py-1.5"
            >
              {!field && <option value={condition.fieldId}>（この項目は今の記録にありません）</option>}
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>

            {needsValue && field && (
              field.choices ? (
                <select
                  value={condition.value}
                  onChange={(e) => update(condition.id, { value: e.target.value })}
                  className="rf-input min-w-0 rounded px-2 py-1.5"
                >
                  <option value="">（選択）</option>
                  {field.choices.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
                  inputMode={field.kind === 'number' ? 'decimal' : undefined}
                  step="any"
                  value={condition.value}
                  onChange={(e) => update(condition.id, { value: e.target.value })}
                  className="rf-input w-32 min-w-0 rounded px-2 py-1.5"
                />
              )
            )}

            <select
              value={condition.op}
              onChange={(e) => update(condition.id, { op: e.target.value as FilterCondition['op'] })}
              className="rf-input min-w-0 rounded px-2 py-1.5"
            >
              {ops.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onChange(conditions.filter((c) => c.id !== condition.id))}
              className="rf-danger text-xs underline"
            >
              外す
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addCondition}
        className="rf-input self-start rounded px-3 py-1 text-sm"
      >
        + 条件を追加
      </button>
    </div>
  )
}

export default FilterBuilder
