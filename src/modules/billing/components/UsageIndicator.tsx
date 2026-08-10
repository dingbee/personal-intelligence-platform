/**
 * Phase 4 Commercial Architecture — a minimal current-usage/limit bar.
 * Deliberately generic over the display value: storage (formatted bytes)
 * and AI messages (plain counts) both render through the same component
 * rather than two near-duplicate bars, per "do not build a giant billing
 * dashboard" — this is the one reusable piece the Settings billing section
 * and, later, other quota surfaces can all share.
 */
export function UsageIndicator({
  label,
  used,
  limit,
  formatValue = (n: number) => n.toLocaleString(),
}: {
  label: string
  used: number
  limit: number | null
  formatValue?: (n: number) => string
}) {
  if (limit === null) {
    return (
      <div>
        <p className="text-xs font-medium text-[var(--color-ink)]">{label}</p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Not available for your account right now.</p>
      </div>
    )
  }

  const ratio = limit > 0 ? Math.min(used / limit, 1) : 1
  const isNearLimit = ratio >= 0.9

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <p className="font-medium text-[var(--color-ink)]">{label}</p>
        <p className="text-[var(--color-ink-muted)]">
          {formatValue(used)} / {formatValue(limit)}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]">
        <div
          className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-[var(--color-warning-strong)]' : 'bg-[var(--color-accent)]'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
