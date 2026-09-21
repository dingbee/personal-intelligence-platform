import { useTheme } from '@/shared/components/theme/ThemeProvider'

const meta = {
  system: { label: 'System', icon: '◐' },
  light: { label: 'Light', icon: '☼' },
  dark: { label: 'Dark', icon: '◐' },
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
      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--surface-raised)] px-3 text-xs font-medium text-[var(--color-ink-muted)] shadow-sm transition-colors hover:bg-[var(--surface-base)] hover:text-[var(--color-ink)]"
    >
      <span className="text-sm leading-none" aria-hidden="true">{current.icon}</span>
      <span>{current.label}</span>
    </button>
  )
}