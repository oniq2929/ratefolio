import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/compressImage'
import { useAuth } from '../contexts/AuthContext'
import RadarChart from '../components/RadarChart'
import RadarChartInput from '../components/RadarChartInput'
import type { Axis, Genre } from '../types/database'

type GenreWithAxes = Genre & { axes: Axis[] }

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function defaultScoreFor(scaleMax: number) {
  return Math.ceil((scaleMax + 1) / 2)
}

interface CreatedEntryPreview {
  targetName: string
  scaleMax: number
  axes: { name: string; score: number }[]
  photoPreviewUrl: string | null
}

function NewEntryPage() {
  const { user } = useAuth()

  const [genres, setGenres] = useState<GenreWithAxes[]>([])
  const [loadingGenres, setLoadingGenres] = useState(true)
  const [selectedGenreId, setSelectedGenreId] = useState<string>('')
  const [targetName, setTargetName] = useState('')
  const [entryDate, setEntryDate] = useState(todayIsoDate())
  const [scores, setScores] = useState<Record<string, number>>({})
  const [tagsInput, setTagsInput] = useState('')
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdEntry, setCreatedEntry] = useState<CreatedEntryPreview | null>(
    null,
  )
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('genres')
      .select('*, axes(*)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setErrorMessage(error.message)
        } else {
          setGenres((data ?? []) as GenreWithAxes[])
        }
        setLoadingGenres(false)
      })
  }, [])

  const selectedGenre = useMemo(
    () => genres.find((g) => g.id === selectedGenreId) ?? null,
    [genres, selectedGenreId],
  )

  const sortedAxes = useMemo(
    () =>
      selectedGenre
        ? [...selectedGenre.axes].sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [selectedGenre],
  )

  const handleSelectGenre = (genreId: string) => {
    setSelectedGenreId(genreId)
    const genre = genres.find((g) => g.id === genreId)
    if (!genre) return
    const initialScores: Record<string, number> = {}
    genre.axes.forEach((axis) => {
      initialScores[axis.id] = defaultScoreFor(genre.scale_max)
    })
    setScores(initialScores)
  }

  const handlePhotoChange = (file: File | null) => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl)
    }
    setPhotoFile(file)
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!user || !selectedGenre) return

    const trimmedName = targetName.trim()
    if (!trimmedName) {
      setErrorMessage('対象名を入力してください。')
      return
    }

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    setSubmitting(true)

    // Storageの命名規則({owner_id}/{entry_id}.拡張子)に合わせるため、
    // entries行のidをクライアント側であらかじめ生成しておく
    const entryId = crypto.randomUUID()
    let photoPath: string | null = null

    if (photoFile) {
      // 一覧の読み込みが重くならないよう、アップロード前に縮小・再圧縮する
      const compressed = await compressImage(photoFile)
      photoPath = `${user.id}/${entryId}.${compressed.ext}`

      const { error: uploadError } = await supabase.storage
        .from('entry-photos')
        .upload(photoPath, compressed.data, { contentType: compressed.contentType })

      if (uploadError) {
        setErrorMessage(uploadError.message)
        setSubmitting(false)
        return
      }
    }

    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        id: entryId,
        owner_id: user.id,
        genre_id: selectedGenre.id,
        genre_name: selectedGenre.name,
        scale_max: selectedGenre.scale_max,
        target_name: trimmedName,
        entry_date: entryDate,
        comment: comment.trim() || null,
        tags,
        is_public: isPublic,
        photo_path: photoPath,
      })
      .select()
      .single()

    if (entryError || !entry) {
      if (photoPath) {
        await supabase.storage.from('entry-photos').remove([photoPath])
      }
      setErrorMessage(entryError?.message ?? '記録の作成に失敗しました。')
      setSubmitting(false)
      return
    }

    const { error: scoresError } = await supabase.from('entry_scores').insert(
      sortedAxes.map((axis) => ({
        entry_id: entry.id,
        axis_id: axis.id,
        axis_name: axis.name,
        sort_order: axis.sort_order,
        score: scores[axis.id],
      })),
    )

    if (scoresError) {
      // スコアの作成に失敗した場合、スコアのない記録・アップロード済みの写真を残さないよう後片付けする
      await supabase.from('entries').delete().eq('id', entry.id)
      if (photoPath) {
        await supabase.storage.from('entry-photos').remove([photoPath])
      }
      setErrorMessage(scoresError.message)
      setSubmitting(false)
      return
    }

    setCreatedEntry({
      targetName: trimmedName,
      scaleMax: selectedGenre.scale_max,
      axes: sortedAxes.map((axis) => ({
        name: axis.name,
        score: scores[axis.id] ?? defaultScoreFor(selectedGenre.scale_max),
      })),
      photoPreviewUrl,
    })
    setTargetName('')
    setTagsInput('')
    setComment('')
    setIsPublic(false)
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }
    handleSelectGenre(selectedGenre.id)
    setSubmitting(false)
  }

  if (loadingGenres) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="rf-muted text-sm">読み込み中...</p>
      </main>
    )
  }

  if (genres.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="rf-heading text-2xl font-semibold">記録を作成</h1>
        <p className="rf-muted mt-4 text-sm">
          記録を作るには、先にジャンルを作成してください。
        </p>
        <Link to="/genres/new" className="rf-link mt-2 inline-block text-sm underline">
          + 新しいジャンルを作成する
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="rf-heading text-2xl font-semibold">記録を作成</h1>

      {createdEntry && (
        <div
          className="rf-surface mt-4 rounded p-4"
          style={{ borderColor: 'var(--rf-success)' }}
        >
          <p className="rf-success text-sm">
            「{createdEntry.targetName}」を記録しました。
          </p>
          <div className="mt-2 flex justify-center">
            <RadarChart axes={createdEntry.axes} scaleMax={createdEntry.scaleMax} size={240} />
          </div>
          {createdEntry.photoPreviewUrl && (
            <div className="mt-2 flex justify-center">
              <img
                src={createdEntry.photoPreviewUrl}
                alt={createdEntry.targetName}
                className="max-h-48 rounded"
              />
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          ジャンル
          <select
            required
            value={selectedGenreId}
            onChange={(e) => handleSelectGenre(e.target.value)}
            className="rf-input rounded px-3 py-2"
          >
            <option value="" disabled>
              選択してください
            </option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </label>

        {selectedGenre && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              対象名
              <input
                type="text"
                required
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                className="rf-input rounded px-3 py-2"
                placeholder="例: ○○そば店"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              日付
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="rf-input rounded px-3 py-2"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm">評価</span>
              <p className="rf-muted text-xs">
                チャート上の点をドラッグするか、軸の上をタップして入力します。
              </p>
              <div className="flex justify-center">
                <RadarChartInput
                  axes={sortedAxes.map((axis) => ({
                    id: axis.id,
                    name: axis.name,
                    score:
                      scores[axis.id] ?? defaultScoreFor(selectedGenre.scale_max),
                  }))}
                  scaleMax={selectedGenre.scale_max}
                  onChange={(axisId, score) =>
                    setScores((prev) => ({ ...prev, [axisId]: score }))
                  }
                />
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              写真（任意、1枚まで）
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                className="cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-[var(--rf-accent)] file:px-3 file:py-2 file:text-sm file:text-[var(--rf-accent-contrast)] file:hover:opacity-90"
              />
            </label>

            {photoPreviewUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={photoPreviewUrl}
                  alt="プレビュー"
                  className="h-24 w-24 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    handlePhotoChange(null)
                    if (photoInputRef.current) {
                      photoInputRef.current.value = ''
                    }
                  }}
                  className="rf-danger text-xs underline"
                >
                  写真を削除
                </button>
              </div>
            )}

            <label className="flex flex-col gap-1 text-sm">
              タグ（カンマ区切り）
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="rf-input rounded px-3 py-2"
                placeholder="例: 濃厚, 大盛り"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              コメント
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="rf-input rounded px-3 py-2"
                rows={3}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              公開する
            </label>

            {errorMessage && <p className="rf-danger text-sm">{errorMessage}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rf-btn-primary mt-2 rounded px-3 py-2 text-sm disabled:opacity-50"
            >
              記録する
            </button>
          </>
        )}
      </form>
    </main>
  )
}

export default NewEntryPage
