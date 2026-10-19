import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Axis, Genre, GenreProperty } from '../types/database'
import { PROPERTY_TYPE_LABELS } from '../lib/properties'

type GenreWithAxes = Genre & { axes: Axis[]; genre_properties: GenreProperty[] }

function GenresPage() {
  const [genres, setGenres] = useState<GenreWithAxes[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    supabase
      .from('genres')
      .select('*, axes(*), genre_properties(*)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setErrorMessage(error.message)
        } else {
          setGenres((data ?? []) as GenreWithAxes[])
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      'このジャンルを削除しますか？既存の記録は残りますが、ジャンルとの紐付けは解除されます。',
    )
    if (!confirmed) return

    const { error } = await supabase.from('genres').delete().eq('id', id)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setGenres((prev) => prev.filter((g) => g.id !== id))
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="rf-heading text-2xl font-semibold">ジャンル管理</h1>
        <Link
          to="/genres/new"
          className="rf-btn-primary rounded px-3 py-2 text-sm"
        >
          + 新しいジャンル
        </Link>
      </div>

      {loading && <p className="rf-muted mt-6 text-sm">読み込み中...</p>}
      {errorMessage && <p className="rf-danger mt-6 text-sm">{errorMessage}</p>}

      {!loading && genres.length === 0 && !errorMessage && (
        <p className="rf-muted mt-6 text-sm">
          まだジャンルがありません。「+ 新しいジャンル」から作成してください。
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {genres.map((genre) => (
          <li key={genre.id} className="rf-surface rounded p-4">
            <div className="flex items-center justify-between">
              <h2 className="rf-heading font-semibold">{genre.name}</h2>
              <button
                type="button"
                onClick={() => handleDelete(genre.id)}
                className="rf-danger text-xs underline"
              >
                削除
              </button>
            </div>
            <p className="rf-muted mt-1 text-xs">{genre.scale_max}段階評価</p>
            <p className="mt-2 text-sm">
              {[...genre.axes]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((axis) => axis.name)
                .join(' / ')}
            </p>
            {genre.genre_properties.length > 0 && (
              <p className="rf-muted mt-1 text-xs">
                プロパティ:{' '}
                {[...genre.genre_properties]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((p) => `${p.name}（${PROPERTY_TYPE_LABELS[p.type]}）`)
                  .join(' / ')}
              </p>
            )}
            <div className="mt-2 flex gap-4">
              <Link
                to={`/genres/${genre.id}/properties`}
                className="rf-link text-xs underline"
              >
                プロパティを管理
              </Link>
              <Link
                to={`/genres/${genre.id}/formulas`}
                className="rf-link text-xs underline"
              >
                計算式を管理
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default GenresPage
