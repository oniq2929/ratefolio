import { THEME_LABELS, useTheme, type ThemeName } from '../contexts/ThemeContext'

const THEME_ORDER: ThemeName[] = ['field-notes', 'radar-bright', 'soft-grid']

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {THEME_ORDER.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => setTheme(name)}
          aria-pressed={theme === name}
          className="shrink-0 rounded px-2 py-1"
          style={{
            background: theme === name ? 'var(--rf-accent)' : 'var(--rf-chip-bg)',
            color: theme === name ? 'var(--rf-accent-contrast)' : 'var(--rf-text)',
          }}
        >
          {THEME_LABELS[name]}
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
