import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PropertyDefinitionsEditor, {
  parseOptions,
  validatePropertyDrafts,
  type PropertyDraft,
} from '../components/PropertyDefinitionsEditor'
import type { Genre, GenreProperty } from '../types/database'

type GenreWithProperties = Genre & { genre_properties: GenreProperty[] }

// 既存ジャンルのプロパティ(都道府県・店・温度など)を追加・変更・削除する画面
function GenrePropertiesPage() {
  const { genreId } = useParams<{ genreId: string }>()
  const navigate = useNavigate()

  const [genre, setGenre] = useState<GenreWithProperties | null>(null)
  const [drafts, setDrafts] = useState<PropertyDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!genreId) return
    supabase
      .from('genres')
      .select('*, genre_properties(*)')
      .eq('id', genreId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setErrorMessage(error?.message ?? 'ジャンルが見つかりません。')
        } else {
          const fetched = data as GenreWithProperties
          setGenre(fetched)
          setDrafts(
            [...fetched.genre_properties]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((p) => ({
                key: p.id,
                id: p.id,
                name: p.name,
                type: p.type,
                optionsInput: p.options.join(', '),
              })),
          )
        }
        setLoading(false)
      })
  }, [genreId])

  const handleSave = async () => {
    if (!genre) return
    setErrorMessage(null)
    const validationError = validatePropertyDrafts(drafts)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setSubmitting(true)

    const removedIds = genre.genre_properties
      .map((p) => p.id)
      .filter((id) => !drafts.some((d) => d.id === id))

    const rows = drafts.map((draft, index) => ({
      // 新しい行にはidを先に振っておき、既存行と同じupsertでまとめて保存する
      id: draft.id ?? crypto.randomUUID(),
      genre_id: genre.id,
      name: draft.name.trim(),
      type: draft.type,
      options: draft.type === 'select' ? parseOptions(draft.optionsInput) : [],
      sort_order: index,
    }))

    const [deleteRes, upsertRes] = await Promise.all([
      removedIds.length > 0
        ? supabase.from('genre_properties').delete().in('id', removedIds)
        : Promise.resolve({ error: null }),
      rows.length > 0
        ? supabase.from('genre_properties').upsert(rows)
        : Promise.resolve({ error: null }),
    ])

    const error = deleteRes.error ?? upsertRes.error
    if (error) {
      setErrorMessage(error.message)
      setSubmitting(false)
      return
    }
    navigate('/genres')
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="rf-muted text-sm">読み込み中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link to="/genres" className="rf-link text-sm underline">
        ← ジャンル管理
      </Link>
      <h1 className="rf-heading mt-2 text-2xl font-semibold">
        {genre ? `「${genre.name}」のプロパティ` : 'プロパティ'}
      </h1>
      <p className="rf-muted mt-1 text-xs">
        記録ごとに入力する項目です。「都道府県」「国」型にすると、記録一覧の地図で集計できます。
        名前を変更しても、作成済みの記録には変更前の名前で残ります。
      </p>

      {genre && (
        <div className="mt-6">
          <PropertyDefinitionsEditor drafts={drafts} onChange={setDrafts} />
        </div>
      )}

      {errorMessage && <p className="rf-danger mt-4 text-sm">{errorMessage}</p>}

      {genre && (
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="rf-btn-primary mt-6 w-full rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? '保存中...' : '保存する'}
        </button>
      )}
    </main>
  )
}

export default GenrePropertiesPage
