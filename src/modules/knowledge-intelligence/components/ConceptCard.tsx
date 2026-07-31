import { Link } from 'react-router-dom'
import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

const SOURCE_TYPE_LABEL: Record<string, string> = {
  document: 'document',
  note: 'note',
  conversation: 'conversation',
}

/**
 * UX-13.11 Phase 2B — "what do I know about X", not "which files contain
 * X": evidence counts by source type + related concepts, not a snippet.
 * The Graph Layer's answer to a search, distinct from the flat
 * SearchResultCard grid documents/notes/conversations render into.
 */
export function ConceptCard({ evidence }: { evidence: KnowledgeNodeEvidence }) {
  const { node, countsBySourceType, relatedNodes } = evidence
  const countEntries = Object.entries(countsBySourceType).filter(([, count]) => count > 0)

  return (
    <Link
      to={`/knowledge/nodes/${node.id}`}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
    >
      <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
        {node.node_type === 'concept' ? 'Concept' : 'Entity'}
      </span>
      <h3 className="mt-1.5 font-medium text-[var(--color-ink)]">{node.title}</h3>
      {node.description && <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">{node.description}</p>}

      {countEntries.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-[var(--color-ink-muted)]">Appears in</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-ink)]">
            {countEntries.map(([type, count]) => (
              <span key={type}>
                {count} {SOURCE_TYPE_LABEL[type] ?? type}
                {count === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        </div>
      )}

      {relatedNodes.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-[var(--color-ink-muted)]">Related</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {relatedNodes.slice(0, 4).map((related) => (
              <span
                key={related.nodeId}
                className="rounded-pill bg-[var(--surface-inset)] px-1.5 py-0.5 text-xs text-[var(--color-ink-muted)] shadow-inset"
              >
                {related.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </Link>
  )
}
