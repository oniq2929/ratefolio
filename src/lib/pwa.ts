// 「ホーム画面に追加」の案内に使う、端末の判定と「次回から表示しない」の記録

const GUIDE_DISMISSED_KEY = 'rf-a2hs-guide-dismissed'

/** iPhone / iPad かどうか(iPadOSはMacとして名乗るため、タッチ対応かどうかでも判定する) */
export function isIos() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/** すでにホーム画面から起動している(アプリとして開いている)かどうか */
export function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

/** 案内を自動で出すべきか: iPhoneのブラウザで開いていて、まだ「表示しない」を選んでいない */
export function shouldShowAddToHomeGuide() {
  if (!isIos() || isStandalone()) return false
  try {
    return localStorage.getItem(GUIDE_DISMISSED_KEY) !== '1'
  } catch {
    return true
  }
}

export function dismissAddToHomeGuide() {
  try {
    localStorage.setItem(GUIDE_DISMISSED_KEY, '1')
  } catch {
    // 保存できなくても、次回また表示されるだけなので問題ない
  }
}
