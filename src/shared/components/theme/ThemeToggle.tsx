import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/shared/components/theme/ThemeProvider'

const meta = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
} as const

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme()
  const current = meta[theme]
  const Icon = current.icon
  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Theme: ${current.label}. Switch to ${meta[next].label}`}
      title={`Theme: ${current.label} · switch to ${meta[next].label}`}
      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--surface-base)] hover:text-[var(--color-ink)]"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
