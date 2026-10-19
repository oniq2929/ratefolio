import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Share2 } from 'lucide-react'

// アプリのURLをQRコードにして、目の前の友達にすぐ読み取ってもらえるようにする。
// QRコードは外部サービスを使わず端末内で作るので、URLが第三者に送られることはない
function ShareAppQr() {
  const appUrl = window.location.origin
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(appUrl, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(() => setMessage('QRコードを作成できませんでした。'))
  }, [appUrl])

  const canShare = typeof navigator.share === 'function'

  const handleShare = async () => {
    try {
      await navigator.share({ title: 'Ratefolio', text: '好きなものを自分の軸で評価・記録できるアプリ', url: appUrl })
    } catch {
      // 共有メニューを閉じただけの場合もここに来るので、何もしない
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl)
      setMessage('URLをコピーしました。')
    } catch {
      setMessage('コピーできませんでした。URLを長押ししてコピーしてください。')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {qrDataUrl ? (
        // QRは白地に黒でないと読み取れない端末があるため、テーマに関係なく白背景にする
        <img
          src={qrDataUrl}
          alt="RatefolioのURLのQRコード"
          className="h-48 w-48 rounded-xl bg-white p-2"
        />
      ) : (
        <div className="rf-muted flex h-48 w-48 items-center justify-center text-xs">作成中...</div>
      )}
      <p className="rf-mono select-all text-xs">{appUrl}</p>
      <div className="flex gap-2">
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="rf-btn-primary flex items-center gap-1 rounded-full px-4 py-2 text-sm"
          >
            <Share2 size={14} aria-hidden="true" />
            共有
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="rf-input flex items-center gap-1 rounded-full px-4 py-2 text-sm"
        >
          <Copy size={14} aria-hidden="true" />
          URLをコピー
        </button>
      </div>
      {message && <p className="rf-muted text-xs">{message}</p>}
    </div>
  )
}

export default ShareAppQr
