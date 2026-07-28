import type { ReactNode } from 'react'

const VARIANT_CLASSES = {
  // A standalone tile — used on its own, not inside another card.
  raised: 'rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4 shadow-raised',
  // A stat chip embedded inside an already-elevated panel (InsightPanel,
  // WorkspaceCard) — recessed rather than re-elevating, so panels full of
  // stats don't turn into cards full of cards.
  inset: 'rounded-control bg-[var(--surface-inset)] px-3 py-2 shadow-inset',
} as const

/**
 * A single labeled stat — the shared building block for stats blocks
 * across Workspace Management, Knowledge Dashboard, etc. (the AI Health
 * dashboard's MetricCard predates this and covers a richer trend/sublabel
 * case that's specific to that page; this is the simpler general-purpose
 * version other surfaces should reach for instead of hand-rolling their
 * own tile or chip).
 */
export function StatCard({
  label,
  value,
  icon,
  variant = 'raised',
}: {
  label: string
  value: string | number
  icon?: ReactNode
  variant?: keyof typeof VARIANT_CLASSES
}) {
  const valueSizeClass = variant === 'raised' ? 'text-2xl' : 'text-lg'
  return (
    <div className={VARIANT_CLASSES[variant]}>
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-ink-muted)]">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`mt-1.5 font-semibold text-[var(--color-ink)] ${valueSizeClass}`}>{value}</p>
    </div>
  )
}
