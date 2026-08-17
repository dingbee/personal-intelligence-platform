import { Link } from 'react-router-dom'
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

/**
 * UX-13 Concept Evolution — one row per concept, emerging/growing concepts
 * first so what's actively changing is what's visible without scrolling.
 *
 * Capability Audit #12, item #3 — each row already carried `nodeId`
 * (used only as the React key) and the node detail page it identifies
 * already exists (`/knowledge/nodes/:nodeId`, KnowledgeNodeDetailPage) —
 * this just connects the two. No new route, no new data, no change to
 * the sorting/scoring above.
 */
export function ConceptEvolutionSection({ concepts }: { concepts: ConceptEvolution[] }) {
  if (concepts.length === 0) {
    return <EmptyState title="No concepts yet" description="Extract knowledge from a document to see how concepts evolve." />
  }

  const priority: Record<ConceptTrendStatus, number> = { emerging: 3, growing: 2, dormant: 1, stable: 0 }
  const sorted = [...concepts].sort((a, b) => priority[b.status] - priority[a.status]).slice(0, DISPLAY_LIMIT)

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((concept) => (
        <li key={concept.nodeId}>
          <Link
            to={`/knowledge/nodes/${concept.nodeId}`}
            className="flex items-center justify-between gap-4 rounded-control text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <span className="text-[var(--color-ink)]">{concept.title}</span>
            <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <span>{concept.degree} connection{concept.degree === 1 ? '' : 's'}</span>
              <StatusBadge label={STATUS_LABEL[concept.status]} variant={STATUS_VARIANT[concept.status]} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
