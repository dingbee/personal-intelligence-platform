export interface MetricTrend {
  direction: 'up' | 'down' | 'flat'
  text: string
  /** Whether this direction is a good sign for this metric (up is good for success rate, bad for latency) — null renders neutral, for a trend that isn't clearly good or bad. */
  isGood: boolean | null
}

/**
 * Soft-raised summary tile — the "tactile card" building block for the AI
 * Health dashboard's usage-overview row. Uses the new shadow-soft token
 * rather than the flat border-only card used elsewhere in Settings, per
 * this phase's neomorphic-lite direction; existing pages are untouched.
 */
export function MetricCard({
  label,
  value,
  sublabel,
  trend,
}: {
  label: string
  value: string
  sublabel?: string
  trend?: MetricTrend
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-soft">
      <p className="text-xs font-medium text-[var(--color-ink-muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-[var(--color-ink)]">{value}</p>
      {(sublabel ?? trend) && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {trend && (
            <span
              className={
                trend.isGood === null ? 'text-[var(--color-ink-muted)]' : trend.isGood ? 'text-green-600' : 'text-red-600'
              }
            >
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.text}
            </span>
          )}
          {sublabel && <span className="text-[var(--color-ink-muted)]">{sublabel}</span>}
        </div>
      )}
    </div>
  )
}
