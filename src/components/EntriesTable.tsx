import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { displayValue, type EntryField, type EntryWithScores } from '../lib/entryFields'

interface EntriesTableProps {
  entries: EntryWithScores[]
  fields: EntryField[]
}

// 記録を表形式で一覧表示する。見出しをタップするとその列で並び替える
function EntriesTable({ entries, fields }: EntriesTableProps) {
  const [sort, setSort] = useState<{ fieldId: string; desc: boolean } | null>(null)

  const sorted = useMemo(() => {
    const field = sort && fields.find((f) => f.id === sort.fieldId)
    if (!field || !sort) return entries
    return [...entries].sort((a, b) => {
      const va = field.get(a)
      const vb = field.get(b)
      // 空の値は並び順に関係なく常に末尾へ
      if (va === undefined) return 1
      if (vb === undefined) return -1
      const result =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'ja')
      return sort.desc ? -result : result
    })
  }, [entries, fields, sort])

  const toggleSort = (fieldId: string) =>
    setSort((prev) =>
      prev?.fieldId === fieldId ? { fieldId, desc: !prev.desc } : { fieldId, desc: true },
    )

  return (
    <div className="rf-surface overflow-x-auto rounded-2xl">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--rf-border)' }}>
            {fields.map((field) => (
              <th
                key={field.id}
                className="rf-muted whitespace-nowrap px-3 py-2 text-left font-semibold"
              >
                <button type="button" onClick={() => toggleSort(field.id)} className="underline-offset-2 hover:underline">
                  {field.label}
                  {sort?.fieldId === field.id ? (sort.desc ? ' ↓' : ' ↑') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={entry.id} style={{ borderBottom: '1px solid var(--rf-border)' }}>
              {fields.map((field, index) => (
                <td
                  key={field.id}
                  className={`px-3 py-2 ${field.kind === 'number' ? 'rf-mono text-right' : ''} ${
                    field.id === 'comment' ? 'max-w-48 truncate' : 'whitespace-nowrap'
                  }`}
                >
                  {index === 0 ? (
                    <Link to={`/entries/${entry.id}/edit`} className="rf-link font-semibold underline">
                      {displayValue(field, entry)}
                    </Link>
                  ) : (
                    displayValue(field, entry)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default EntriesTable
