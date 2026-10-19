// スマホのカメラ画像はそのままだと数MBあり、一覧の読み込みが重くなるため、
// アップロード前に長辺を縮小してJPEGに再エンコードする。
//
// 端末によって写真の渡され方がまちまちなため、以下のケースに備えている
// (「自分のiPhoneでは動くが、他の人のスマホでは失敗する」原因になりやすい):
//  - file.type が空文字で渡される(Androidの一部ギャラリーアプリ等)
//  - HEIC/HEIF形式(iPhoneの写真。Safari以外のブラウザでは読めないことがある)
//  - createImageBitmap が使えない/オプション指定で失敗する(古いiOS Safari)
//  - 高画素の写真でメモリ不足になり、縮小処理自体が失敗する

const MAX_EDGE = 1280
const JPEG_QUALITY = 0.8

// アップロードを許可する上限。Supabase側のバケット設定と同じ値にしておき、
// 超過時はアプリ側で分かりやすいエラーを出す
// (バケット側だけに任せると、英語の分かりにくいエラーが表示されるため)
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export interface CompressedImage {
  data: Blob | File
  contentType: string
  ext: string
}

// 写真を読み込めなかったときに投げるエラー。画面側で日本語の説明を出すために使う
export class PhotoError extends Error {}

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
}

function extOf(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ext in EXT_TO_MIME ? ext : ''
}

function asOriginal(file: File): CompressedImage {
  const ext = extOf(file) || 'jpg'
  return {
    data: file,
    // typeが空のファイルは拡張子から推定する(空のままだとアップロードで弾かれることがある)
    contentType: file.type || EXT_TO_MIME[ext] || 'image/jpeg',
    ext,
  }
}

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// 画像を描画できる形(幅・高さ・描画関数)で読み込む。
// まずcreateImageBitmapを試し、ダメならimg要素で読み込む
async function loadImage(file: File): Promise<{
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  release: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation: 'from-image' で、スマホ写真の回転情報を反映させる
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        release: () => bitmap.close(),
      }
    } catch {
      // 古いSafariなど、オプション付きの呼び出しに対応していない場合はimg要素で読み直す
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      release: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

export async function compressImage(file: File): Promise<CompressedImage> {
  // typeが空でも画像のことがあるため、「明らかに画像以外」のときだけ弾く
  if (file.type && !file.type.startsWith('image/')) {
    throw new PhotoError('画像ファイルを選択してください。')
  }

  try {
    const image = await loadImage(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      image.release()
      throw new Error('canvas unavailable')
    }

    image.draw(context, width, height)
    image.release()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })

    // 圧縮しても小さくならない場合(元がもともと軽いJPEG等)は元ファイルを使う。
    // ただしHEICなど、他のブラウザで表示できない形式はJPEGを優先する
    const original = asOriginal(file)
    const browserFriendly = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
      original.contentType,
    )
    if (blob && (blob.size < file.size || !browserFriendly)) {
      return { data: blob, contentType: 'image/jpeg', ext: 'jpg' }
    }
    if (original.data.size > MAX_UPLOAD_BYTES) {
      throw new PhotoError(
        `写真のサイズが大きすぎます（${formatMb(original.data.size)}）。別の写真を選んでください。`,
      )
    }
    return original
  } catch (error) {
    if (error instanceof PhotoError) throw error

    // 縮小に失敗しても、そのままアップロードできる大きさ・形式なら元ファイルを使う
    const original = asOriginal(file)
    if (original.data.size <= MAX_UPLOAD_BYTES) {
      return original
    }
    throw new PhotoError(
      `この写真を読み込めませんでした（形式: ${file.type || '不明'}、サイズ: ${formatMb(file.size)}）。` +
        'スクリーンショットや別の写真でお試しください。',
    )
  }
}

// アップロードエラー(英語)を、利用者に分かる日本語に置き換える
export function describeUploadError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('mime') || lower.includes('content type')) {
    return `この形式の写真はアップロードできません（${message}）。JPEGかPNGの写真でお試しください。`
  }
  if (lower.includes('size') || lower.includes('too large') || lower.includes('payload')) {
    return '写真のサイズが大きすぎます。別の写真を選んでください。'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return '通信に失敗しました。電波の良い場所でもう一度お試しください。'
  }
  return `写真のアップロードに失敗しました（${message}）。`
}
