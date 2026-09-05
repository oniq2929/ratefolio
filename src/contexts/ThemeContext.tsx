import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type ThemeName = 'field-notes' | 'radar-bright' | 'soft-grid' | 'quiet-slate'

const STORAGE_KEY = 'ratefolio-theme'
const DEFAULT_THEME: ThemeName = 'field-notes'
const THEME_NAMES: ThemeName[] = [
  'field-notes',
  'radar-bright',
  'soft-grid',
  'quiet-slate',
]

export const THEME_LABELS: Record<ThemeName, string> = {
  'field-notes': 'Field Notes',
  'radar-bright': 'Radar Bright',
  'soft-grid': 'Soft Grid',
  'quiet-slate': 'Quiet Slate',
}

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readInitialTheme(): ThemeName {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return THEME_NAMES.includes(stored as ThemeName)
    ? (stored as ThemeName)
    : DEFAULT_THEME
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(readInitialTheme)

  useEffect(() => {
    // index.htmlの初期化スクリプトと同じ属性を、切り替えのたびに更新する
    document.documentElement.setAttribute('data-app-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme()はThemeProviderの内側で呼び出してください')
  }
  return context
}
