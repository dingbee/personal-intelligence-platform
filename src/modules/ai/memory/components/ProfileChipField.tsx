/** UX-13.6 Phase 2 — a labeled multi-select: curated options plus whatever's already selected (so a value NOVA already knows never disappears just because it's not in the curated list), rendered as toggleable chips. */
export function ProfileChipField({
  label,
  why,
  options,
  selected,
  onToggle,
}: {
  label: string
  why?: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  const allOptions = [...new Set([...options, ...selected])]

  return (
    <div className="flex flex-col gap-1.5 border-b border-[var(--color-border)] py-3 first:pt-0 last:border-b-0 last:pb-0">
      <label className="text-xs font-medium text-[var(--color-ink-muted)]">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {allOptions.map((option) => {
          const isSelected = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={isSelected}
              className={`rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors ${
                isSelected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--surface-inset)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {isSelected && '✓ '}
              {option}
            </button>
          )
        })}
      </div>
      {why && <p className="text-xs text-[var(--color-ink-muted)]">{why}</p>}
    </div>
  )
}
