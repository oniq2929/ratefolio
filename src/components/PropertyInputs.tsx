import { choicesFor, type PropertyField } from '../lib/properties'

interface PropertyInputsProps {
  fields: PropertyField[]
  onChange: (key: string, raw: string) => void
}

// 記録の作成・編集画面で、ジャンルに定義されたプロパティを型に応じた入力欄で表示する
function PropertyInputs({ fields, onChange }: PropertyInputsProps) {
  if (fields.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm">プロパティ</span>
      {fields.map((field) => {
        const choices = choicesFor(field.type, field.options)
        return (
          <label key={field.key} className="flex items-center gap-3 text-sm">
            <span className="rf-muted w-24 flex-shrink-0 truncate">{field.name}</span>
            {choices ? (
              <select
                value={field.raw}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rf-input min-w-0 flex-1 rounded px-3 py-2"
              >
                <option value="">未設定</option>
                {/* 保存済みの値が選択肢から消えていても表示できるようにする */}
                {field.raw && !choices.includes(field.raw) && (
                  <option value={field.raw}>{field.raw}</option>
                )}
                {choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                inputMode={field.type === 'number' ? 'decimal' : undefined}
                step="any"
                value={field.raw}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rf-input min-w-0 flex-1 rounded px-3 py-2"
              />
            )}
          </label>
        )
      })}
    </div>
  )
}

export default PropertyInputs
