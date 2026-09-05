import { Hexagon, Leaf, Sparkles } from 'lucide-react'
import { THEME_LABELS, useTheme, type ThemeName } from '../contexts/ThemeContext'

const THEME_ORDER: ThemeName[] = ['field-notes', 'radar-bright', 'soft-grid']

const THEME_ICONS: Record<ThemeName, typeof Leaf> = {
  'field-notes': Leaf,
  'radar-bright': Sparkles,
  'soft-grid': Hexagon,
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {THEME_ORDER.map((name) => {
        const Icon = THEME_ICONS[name]
        const active = theme === name

        return (
          <button
            key={name}
            type="button"
            onClick={() => setTheme(name)}
            aria-pressed={active}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors"
            style={{
              background: active
                ? 'color-mix(in srgb, var(--rf-accent) 14%, var(--rf-surface))'
                : 'var(--rf-surface)',
              border: `1px solid ${active ? 'var(--rf-accent)' : 'var(--rf-border)'}`,
              color: active ? 'var(--rf-accent)' : 'var(--rf-text)',
            }}
          >
            <Icon size={14} aria-hidden="true" />
            {THEME_LABELS[name]}
          </button>
        )
      })}
    </div>
  )
}

export default ThemeSwitcher
