import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const MIN_AXES = 3
const MAX_AXES = 8
const SCALE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10]

function NewGenrePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [scaleMax, setScaleMax] = useState(5)
  const [axisNames, setAxisNames] = useState<string[]>(['', '', ''])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const updateAxisName = (index: number, value: string) => {
    setAxisNames((prev) => prev.map((n, i) => (i === index ? value : n)))
  }

  const addAxis = () => {
    if (axisNames.length >= MAX_AXES) return
    setAxisNames((prev) => [...prev, ''])
  }

  const removeAxis = (index: number) => {
    if (axisNames.length <= MIN_AXES) return
    setAxisNames((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!user) return

    const trimmedName = name.trim()
    const trimmedAxes = axisNames.map((axisName) => axisName.trim())

    if (!trimmedName) {
      setErrorMessage('ジャンル名を入力してください。')
      return
    }
    if (trimmedAxes.some((axisName) => !axisName)) {
      setErrorMessage('すべての評価軸名を入力してください。')
      return
    }

    setSubmitting(true)

    const { data: genre, error: genreError } = await supabase
      .from('genres')
      .insert({ owner_id: user.id, name: trimmedName, scale_max: scaleMax })
      .select()
      .single()

    if (genreError || !genre) {
      setErrorMessage(genreError?.message ?? 'ジャンルの作成に失敗しました。')
      setSubmitting(false)
      return
    }

    const { error: axesError } = await supabase.from('axes').insert(
      trimmedAxes.map((axisName, index) => ({
        genre_id: genre.id,
        name: axisName,
        sort_order: index,
      })),
    )

    if (axesError) {
      // 軸の作成に失敗した場合、軸のないジャンルだけが残らないよう後片付けする
      await supabase.from('genres').delete().eq('id', genre.id)
      setErrorMessage(axesError.message)
      setSubmitting(false)
      return
    }

    navigate('/genres')
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="rf-heading text-2xl font-semibold">新しいジャンル</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          ジャンル名
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rf-input rounded px-3 py-2"
            placeholder="例: 蕎麦"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          評価スケール(何段階評価か)
          <select
            value={scaleMax}
            onChange={(e) => setScaleMax(Number(e.target.value))}
            className="rf-input rounded px-3 py-2"
          >
            {SCALE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}段階評価
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm">
            評価軸（{MIN_AXES}〜{MAX_AXES}個。レーダーチャート表示のため3個以上必要です）
          </span>
          {axisNames.map((axisName, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                required
                value={axisName}
                onChange={(e) => updateAxisName(index, e.target.value)}
                className="rf-input flex-1 rounded px-3 py-2 text-sm"
                placeholder={`例: 軸${index + 1}`}
              />
              <button
                type="button"
                onClick={() => removeAxis(index)}
                disabled={axisNames.length <= MIN_AXES}
                className="rf-input rounded px-2 text-sm disabled:opacity-30"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAxis}
            disabled={axisNames.length >= MAX_AXES}
            className="rf-input self-start rounded px-3 py-1 text-sm disabled:opacity-30"
          >
            + 軸を追加
          </button>
        </div>

        {errorMessage && <p className="rf-danger text-sm">{errorMessage}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rf-btn-primary mt-2 rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          作成する
        </button>
      </form>
    </main>
  )
}

export default NewGenrePage
