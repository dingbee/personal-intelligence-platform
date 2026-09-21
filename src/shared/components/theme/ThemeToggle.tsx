import { useTheme, type ThemePreference } from '@/shared/components/theme/ThemeProvider'

const options: Array<{ value: ThemePreference; label: string; icon: string }> = [
  { value: 'system', label: 'System', icon: '◐' },
  { value: 'light', label: 'Light', icon: '☼' },
  { value: 'dark', label: 'Dark', icon: '◐' },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div role="group" aria-label="Appearance" className="flex h-9 w-full items-center rounded-full border border-[var(--color-border)] bg-[var(--surface-inset)] p-0.5">
      {options.map((option) => {
        const active = theme === option.value
        return (
          <button key={option.value} type="button" onClick={() => setTheme(option.value)} aria-pressed={active} aria-label={`${option.label} theme`} title={`${option.label} theme`} className={`inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1 text-[11px] font-medium whitespace-nowrap transition-colors ${active ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-ink-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--color-ink)]'}`}>
            <span aria-hidden="true">{option.icon}</span><span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
