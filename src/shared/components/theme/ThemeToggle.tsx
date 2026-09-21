import { useTheme, type ThemePreference } from '@/shared/components/theme/ThemeProvider'

const options: Array<{ value: ThemePreference; label: string; icon: string }> = [
  { value: 'system', label: 'System', icon: '◐' },
  { value: 'light', label: 'Light', icon: '☼' },
  { value: 'dark', label: 'Dark', icon: '◐' },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div role="group" aria-label="Theme" className="inline-flex h-9 items-center rounded-full border border-[var(--color-border)] bg-[var(--surface-inset)] p-0.5 shadow-inset">
      {options.map((option) => {
        const active = theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            aria-label={`${option.label} theme`}
            title={`${option.label} theme`}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors ${active ? 'bg-[var(--surface-raised)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'}`}
          >
            <span aria-hidden="true">{option.icon}</span>
            <span className="hidden xl:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}