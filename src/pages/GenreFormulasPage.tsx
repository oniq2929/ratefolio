import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Axis, Formula, Genre } from '../types/database'

type GenreWithAxes = Genre & { axes: Axis[] }

function GenreFormulasPage() {
  const { genreId } = useParams<{ genreId: string }>()
  const { user } = useAuth()

  const [genre, setGenre] = useState<GenreWithAxes | null>(null)
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!genreId) return

    supabase
      .from('genres')
      .select('*, axes(*)')
      .eq('id', genreId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setErrorMessage(error?.message ?? 'ジャンルが見つかりません。')
          setLoading(false)
          return
        }
        const genreData = data as GenreWithAxes
        setGenre(genreData)

        const initialWeights: Record<string, number> = {}
        genreData.axes.forEach((axis) => {
          initialWeights[axis.name] = 0
        })
        setWeights(initialWeights)

        supabase
          .from('formulas')
          .select('*')
          .eq('genre_name', genreData.name)
          .order('created_at', { ascending: false })
          .then(({ data: formulaData, error: formulaError }) => {
            if (formulaError) {
              setErrorMessage(formulaError.message)
            } else {
              setFormulas((formulaData ?? []) as Formula[])
            }
            setLoading(false)
          })
      })
  }, [genreId])

  const sortedAxes = useMemo(
    () =>
      genre ? [...genre.axes].sort((a, b) => a.sort_order - b.sort_order) : [],
    [genre],
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!user || !genre) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage('式の名前を入力してください。')
      return
    }

    setSubmitting(true)

    const { data, error } = await supabase
      .from('formulas')
      .insert({
        owner_id: user.id,
        genre_name: genre.name,
        name: trimmedName,
        weights,
      })
      .select()
      .single()

    if (error || !data) {
      setErrorMessage(error?.message ?? '式の作成に失敗しました。')
      setSubmitting(false)
      return
    }

    setFormulas((prev) => [data as Formula, ...prev])
    setName('')
    setWeights(Object.fromEntries(sortedAxes.map((axis) => [axis.name, 0])))
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('formulas').delete().eq('id', id)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setFormulas((prev) => prev.filter((f) => f.id !== id))
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="rf-muted text-sm">読み込み中...</p>
      </main>
    )
  }

  if (!genre) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="rf-danger text-sm">
          {errorMessage ?? 'ジャンルが見つかりません。'}
        </p>
        <Link to="/genres" className="rf-link mt-2 inline-block text-sm underline">
          ジャンル一覧に戻る
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link to="/genres" className="rf-link text-sm underline">
        ← ジャンル一覧
      </Link>
      <h1 className="rf-heading mt-2 text-2xl font-semibold">{genre.name}の評価式</h1>
      <p className="rf-muted mt-1 text-sm">
        各評価軸に重みを掛けて足し算した「カスタム評価式」を作成できます。マイナスの値を入れると、その軸を引き算として使えます。
      </p>

      {errorMessage && <p className="rf-danger mt-4 text-sm">{errorMessage}</p>}

      <form
        onSubmit={handleSubmit}
        className="rf-surface mt-6 flex flex-col gap-4 rounded p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          式の名前
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rf-input rounded px-3 py-2"
            placeholder="例: コスパ重視"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm">各軸の重み</span>
          {sortedAxes.map((axis) => (
            <label key={axis.id} className="flex items-center gap-2 text-sm">
              <span className="w-20">{axis.name}</span>
              <input
                type="number"
                step="0.1"
                value={weights[axis.name] ?? 0}
                onChange={(e) =>
                  setWeights((prev) => ({
                    ...prev,
                    [axis.name]: Number(e.target.value),
                  }))
                }
                className="rf-input w-24 rounded px-2 py-1"
              />
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rf-btn-primary self-start rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          式を保存
        </button>
      </form>

      <h2 className="rf-heading mt-8 text-lg font-semibold">保存済みの式</h2>
      {formulas.length === 0 && (
        <p className="rf-muted mt-2 text-sm">まだ式がありません。</p>
      )}
      <ul className="mt-2 flex flex-col gap-2">
        {formulas.map((formula) => (
          <li key={formula.id} className="rf-surface rounded p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{formula.name}</span>
              <button
                type="button"
                onClick={() => handleDelete(formula.id)}
                className="rf-danger text-xs underline"
              >
                削除
              </button>
            </div>
            <p className="rf-muted mt-1 text-xs">
              {Object.entries(formula.weights)
                .filter(([, weight]) => weight !== 0)
                .map(([axisName, weight]) => `${weight}×${axisName}`)
                .join(' + ') || '(すべて重み0)'}
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default GenreFormulasPage
