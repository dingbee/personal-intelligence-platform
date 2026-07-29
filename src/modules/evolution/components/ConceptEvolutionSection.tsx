import type { ConceptEvolution, ConceptTrendStatus } from '@/modules/evolution/conceptEvolution/conceptTrend'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const STATUS_LABEL: Record<ConceptTrendStatus, string> = {
  emerging: 'Emerging',
  growing: 'Growing',
  stable: 'Stable',
  dormant: 'Dormant',
}

const STATUS_VARIANT: Record<ConceptTrendStatus, 'success' | 'info' | 'neutral' | 'warning'> = {
  emerging: 'info',
  growing: 'success',
  stable: 'neutral',
  dormant: 'warning',
}

const DISPLAY_LIMIT = 20

/** UX-13 Concept Evolution — one row per concept, emerging/growing concepts first so what's actively changing is what's visible without scrolling. */
export function ConceptEvolutionSection({ concepts }: { concepts: ConceptEvolution[] }) {
  if (concepts.length === 0) {
    return <EmptyState title="No concepts yet" description="Extract knowledge from a document to see how concepts evolve." />
  }

  const priority: Record<ConceptTrendStatus, number> = { emerging: 3, growing: 2, dormant: 1, stable: 0 }
  const sorted = [...concepts].sort((a, b) => priority[b.status] - priority[a.status]).slice(0, DISPLAY_LIMIT)

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((concept) => (
        <li key={concept.nodeId} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--color-ink)]">{concept.title}</span>
          <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            <span>{concept.degree} connection{concept.degree === 1 ? '' : 's'}</span>
            <StatusBadge label={STATUS_LABEL[concept.status]} variant={STATUS_VARIANT[concept.status]} />
          </div>
        </li>
      ))}
    </ul>
  )
}
