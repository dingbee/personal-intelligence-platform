/**
 * Small provenance indicator for an AI-generated relationship's confidence
 * score. Phase UX-3.5: the "restylable in one place" neomorphic pass this
 * predated — an inset pill (recessed, not raised), since this is metadata
 * embedded in a card, not its own elevated surface.
 */
export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null

  const pct = Math.round(confidence * 100)
  const toneClass =
    confidence >= 0.7 ? 'text-[var(--color-success)]' : confidence >= 0.4 ? 'text-[var(--color-warning)]' : 'text-[var(--color-ink-muted)]'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill bg-[var(--surface-inset)] px-1.5 py-0.5 text-xs font-medium shadow-inset ${toneClass}`}
    >
      {pct}%
    </span>
  )
}
