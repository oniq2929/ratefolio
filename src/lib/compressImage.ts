// スマホのカメラ画像はそのままだと数MBあり、一覧の読み込みが重くなるため、
// アップロード前に長辺を縮小してJPEGに再エンコードする。
// 変換に失敗した場合は元のファイルをそのまま使う(アップロード自体は成功させる)。

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

function asOriginal(file: File): CompressedImage {
  return {
    data: file,
    contentType: file.type || 'application/octet-stream',
    ext: file.name.split('.').pop() || 'jpg',
  }
}

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    return asOriginal(file)
  }

  try {
    // imageOrientation: 'from-image' で、スマホ写真の回転情報を反映させる
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return asOriginal(file)
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })

    // 圧縮しても小さくならない場合(元がもともと軽いPNG等)は元ファイルを使う
    if (!blob || blob.size >= file.size) {
      return asOriginal(file)
    }

    return { data: blob, contentType: 'image/jpeg', ext: 'jpg' }
  } catch {
    return asOriginal(file)
  }
}
