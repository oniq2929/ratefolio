import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { compressImage, MAX_UPLOAD_BYTES } from '../lib/compressImage'
import { useAuth } from '../contexts/AuthContext'
import RadarChartInput from '../components/RadarChartInput'
import type { Entry, EntryScore } from '../types/database'

type EntryWithScores = Entry & { entry_scores: EntryScore[] }

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function EditEntryPage() {
  const { entryId } = useParams<{ entryId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [entry, setEntry] = useState<EntryWithScores | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [targetName, setTargetName] = useState('')
  const [entryDate, setEntryDate] = useState(todayIsoDate())
  // entry_scoresの行id → スコア
  const [scores, setScores] = useState<Record<string, number>>({})
  const [tagsInput, setTagsInput] = useState('')
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user || !entryId) return

    // RLSに加えて、自分の記録であることをクエリでも明示的に絞り込む
    supabase
      .from('entries')
      .select('*, entry_scores(*)')
      .eq('id', entryId)
      .eq('owner_id', user.id)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          setErrorMessage(error?.message ?? '記録が見つかりません。')
          setLoading(false)
          return
        }

        const fetched = data as EntryWithScores
        setEntry(fetched)
        setTargetName(fetched.target_name)
        setEntryDate(fetched.entry_date)
        setTagsInput(fetched.tags.join(', '))
        setComment(fetched.comment ?? '')
        setIsPublic(fetched.is_public)
        setScores(
          Object.fromEntries(fetched.entry_scores.map((s) => [s.id, s.score])),
        )
        setLoading(false)

        if (fetched.photo_path) {
          const { data: signed } = await supabase.storage
            .from('entry-photos')
            .createSignedUrl(fetched.photo_path, 60 * 60)
          if (signed?.signedUrl) setCurrentPhotoUrl(signed.signedUrl)
        }
      })
  }, [user, entryId])

  const handlePhotoChange = (file: File | null) => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(file)
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
    if (file) setRemovePhoto(false)
  }

  // 「2回目を食べた」のように、同じ対象を再訪したときの記述を足しやすくする
  const handleAppendVisit = () => {
    const separator = comment.trim() ? '\n\n' : ''
    setComment(`${comment}${separator}${todayIsoDate()} 再訪: `)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!user || !entry) return

    const trimmedName = targetName.trim()
    if (!trimmedName) {
      setErrorMessage('対象名を入力してください。')
      return
    }

    setSubmitting(true)

    let photoPath = entry.photo_path
    const oldPhotoPath = entry.photo_path

    if (photoFile) {
      const compressed = await compressImage(photoFile)

      if (compressed.data.size > MAX_UPLOAD_BYTES) {
        setErrorMessage(
          '写真のサイズが大きすぎます。別の写真を選ぶか、撮影サイズを小さくしてください。',
        )
        setSubmitting(false)
        return
      }

      const newPath = `${user.id}/${entry.id}.${compressed.ext}`

      const { error: uploadError } = await supabase.storage
        .from('entry-photos')
        .upload(newPath, compressed.data, {
          contentType: compressed.contentType,
          upsert: true,
        })

      if (uploadError) {
        setErrorMessage(uploadError.message)
        setSubmitting(false)
        return
      }
      photoPath = newPath
    } else if (removePhoto) {
      photoPath = null
    }

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const { error: updateError } = await supabase
      .from('entries')
      .update({
        target_name: trimmedName,
        entry_date: entryDate,
        comment: comment.trim() || null,
        tags,
        is_public: isPublic,
        photo_path: photoPath,
      })
      .eq('id', entry.id)
      .eq('owner_id', user.id)

    if (updateError) {
      setErrorMessage(updateError.message)
      setSubmitting(false)
      return
    }

    // スコアは変更があった軸だけ更新する
    const changed = entry.entry_scores.filter(
      (s) => scores[s.id] !== undefined && scores[s.id] !== s.score,
    )
    for (const scoreRow of changed) {
      const { error: scoreError } = await supabase
        .from('entry_scores')
        .update({ score: scores[scoreRow.id] })
        .eq('id', scoreRow.id)

      if (scoreError) {
        setErrorMessage(scoreError.message)
        setSubmitting(false)
        return
      }
    }

    // 写真を差し替え/削除したあとに、不要になった古いファイルを片付ける
    if (oldPhotoPath && oldPhotoPath !== photoPath) {
      await supabase.storage.from('entry-photos').remove([oldPhotoPath])
    }

    navigate('/entries')
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="rf-muted text-sm">読み込み中...</p>
      </main>
    )
  }

  if (!entry) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="rf-danger text-sm">
          {errorMessage ?? '記録が見つかりません。'}
        </p>
        <Link to="/entries" className="rf-link mt-2 inline-block text-sm underline">
          記録一覧に戻る
        </Link>
      </main>
    )
  }

  const sortedScores = [...entry.entry_scores].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  const previewUrl = photoPreviewUrl ?? (removePhoto ? null : currentPhotoUrl)

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link to="/entries" className="rf-link text-sm underline">
        ← 記録一覧
      </Link>
      <h1 className="rf-heading mt-2 text-2xl font-semibold">記録を編集</h1>
      <p className="rf-muted mt-1 text-xs">
        {entry.genre_name}（ジャンルと評価軸は変更できません）
      </p>

      {errorMessage && <p className="rf-danger mt-4 text-sm">{errorMessage}</p>}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm">
          対象名
          <input
            type="text"
            required
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            className="rf-input rounded px-3 py-2"
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
              axes={sortedScores.map((s) => ({
                id: s.id,
                name: s.axis_name,
                score: scores[s.id] ?? s.score,
              }))}
              scaleMax={entry.scale_max}
              onChange={(scoreId, score) =>
                setScores((prev) => ({ ...prev, [scoreId]: score }))
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          写真
          {previewUrl && (
            <img
              src={previewUrl}
              alt={targetName}
              className="max-h-56 rounded-xl object-contain"
            />
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
            className="cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-[var(--rf-accent)] file:px-3 file:py-2 file:text-sm file:text-[var(--rf-accent-contrast)] file:hover:opacity-90"
          />
          {entry.photo_path && !photoFile && (
            <label className="rf-muted flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={removePhoto}
                onChange={(e) => setRemovePhoto(e.target.checked)}
              />
              写真を削除する
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          タグ（カンマ区切り）
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="rf-input rounded px-3 py-2"
            placeholder="例: 昼, 出張"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between">
            コメント
            <button
              type="button"
              onClick={handleAppendVisit}
              className="rf-link text-xs underline"
            >
              + 再訪の記録を追記
            </button>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            className="rf-input rounded px-3 py-2"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          この記録を公開する
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rf-btn-primary rounded-full py-3 text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? '保存中...' : '変更を保存'}
        </button>
      </form>
    </main>
  )
}

export default EditEntryPage
