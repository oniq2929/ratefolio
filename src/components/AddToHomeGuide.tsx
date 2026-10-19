import { useState } from 'react'
import { Share, SquarePlus, X } from 'lucide-react'
import { dismissAddToHomeGuide } from '../lib/pwa'

interface AddToHomeGuideProps {
  onClose: () => void
}

// iPhoneで「ホーム画面に追加」する手順を案内するポップアップ。
// iPhoneはAndroidと違い、アプリ側から追加ボタンを出せない(Safariの共有メニューからしか追加できない)ため、
// 手順を文章とアイコンで見せる
function AddToHomeGuide({ onClose }: AddToHomeGuideProps) {
  const [dontShowAgain, setDontShowAgain] = useState(true)

  const handleClose = () => {
    if (dontShowAgain) dismissAddToHomeGuide()
    onClose()
  }

  const steps = [
    {
      icon: Share,
      text: (
        <>
          画面下（iPadは右上）の<strong>共有ボタン</strong>をタップ
        </>
      ),
    },
    {
      icon: SquarePlus,
      text: (
        <>
          メニューを下にスクロールして<strong>「ホーム画面に追加」</strong>をタップ
        </>
      ),
    },
    {
      icon: null,
      text: (
        <>
          右上の<strong>「追加」</strong>をタップすると、ホーム画面にRatefolioのアイコンができます
        </>
      ),
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: 'rgb(0 0 0 / 0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="a2hs-title"
    >
      <div className="rf-surface w-full max-w-sm rounded-2xl p-5" style={{ background: 'var(--rf-surface)' }}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="a2hs-title" className="rf-heading text-lg font-semibold">
            ホーム画面に追加しましょう
          </h2>
          <button type="button" onClick={handleClose} aria-label="閉じる" className="rf-muted">
            <X size={20} />
          </button>
        </div>
        <p className="rf-muted mt-1 text-xs">
          アプリのようにワンタップで開けるようになります（Safariで開いている場合の手順です）。
        </p>

        <ol className="mt-4 flex flex-col gap-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={index} className="flex items-start gap-3 text-sm">
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--rf-accent)', color: 'var(--rf-accent-contrast)' }}
                >
                  {index + 1}
                </span>
                <span className="flex-1">
                  {step.text}
                  {Icon && <Icon size={16} className="rf-accent ml-1 inline align-text-bottom" aria-hidden="true" />}
                </span>
              </li>
            )
          })}
        </ol>

        <label className="rf-muted mt-4 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          次回から表示しない（プロフィールからいつでも見られます）
        </label>

        <button
          type="button"
          onClick={handleClose}
          className="rf-btn-primary mt-4 w-full rounded-full py-2.5 text-sm font-semibold"
        >
          わかった
        </button>
      </div>
    </div>
  )
}

export default AddToHomeGuide
