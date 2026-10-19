// 記録をCSVファイルとして書き出す処理
import { displayValue, type EntryField, type EntryWithScores } from './entryFields'

// カンマ・改行・ダブルクォートを含む値は、全体を""で囲み、中の"は""に重ねる(CSVの決まり)
function escapeCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function buildCsv(entries: EntryWithScores[], fields: EntryField[]) {
  const header = fields.map((f) => escapeCell(f.label)).join(',')
  const rows = entries.map((entry) =>
    fields
      .map((field) => {
        const value = displayValue(field, entry)
        return escapeCell(value === '-' ? '' : value)
      })
      .join(','),
  )
  return [header, ...rows].join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  // 先頭のBOM(\uFEFF)は、Excelで開いたときに日本語が文字化けしないようにするための印
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
