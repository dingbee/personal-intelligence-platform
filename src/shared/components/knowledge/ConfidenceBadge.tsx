/**
 * Small provenance indicator for an AI-generated relationship's confidence
 * score. Deliberately plain (canvas pill + colored text, same shape as the
 * file-type pill on DocumentDetailPage) rather than introducing a new
 * colored-background pattern — keeps this restylable in one place for
 * Phase 8's neomorphic pass instead of scattered across call sites.
 */
export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null

  const pct = Math.round(confidence * 100)
  const toneClass =
    confidence >= 0.7 ? 'text-green-600' : confidence >= 0.4 ? 'text-amber-600' : 'text-[var(--color-ink-muted)]'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {pct}%
    </span>
  )
}
