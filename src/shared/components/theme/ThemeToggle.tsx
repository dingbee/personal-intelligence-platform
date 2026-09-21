import { useTheme } from '@/shared/components/theme/ThemeProvider'

const meta = {
  system: { label: 'System', glyph: '◐' },
  light: { label: 'Light', glyph: '☼' },
  dark: { label: 'Dark', glyph: '◐' },
} as const

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme()
  const current = meta[theme]
  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Theme: ${current.label}. Switch to ${meta[next].label}`}
      title={`Theme: ${current.label} · switch to ${meta[next].label}`}
      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--surface-base)] hover:text-[var(--color-ink)]"
    >
      <span className="text-base leading-none" aria-hidden="true">{current.glyph}</span>
    </button>
  )
}
