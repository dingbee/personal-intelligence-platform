import { Link } from 'react-router-dom'
import { useKnowledgeNodes, useRunKnowledgeExtraction } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { KnowledgeCard } from '@/shared/components/knowledge/KnowledgeCard'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Document Detail's "Analyze Document" / "View Knowledge Map" controls.
 * There is one backend action (runKnowledgeExtraction, from Phase 7A) —
 * the button relabels itself ("Analyze Document" -> "Re-analyze") rather
 * than presenting a second, identically-behaving "Extract Knowledge"
 * button, since nothing distinct exists behind that second label.
 *
 * "Preserve previous generated knowledge" and "show processing state"
 * come for free from TanStack Query's cache: existing nodes stay visible
 * while a regeneration is pending, since the query isn't cleared until
 * the mutation succeeds and invalidates it.
 */
export function KnowledgeExtractionPanel({ documentId }: { documentId: string }) {
  const { data: nodes = [], isLoading } = useKnowledgeNodes(documentId)
  const extraction = useRunKnowledgeExtraction(documentId)
  const hasResults = nodes.length > 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Knowledge</h2>
        <div className="flex items-center gap-3">
          {hasResults && (
            <Link
              to={`/knowledge/explorer?documentId=${documentId}`}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              View Knowledge Map →
            </Link>
          )}
          <Button variant="secondary" loading={extraction.isPending} onClick={() => extraction.mutate()}>
            {hasResults ? 'Re-analyze' : 'Analyze Document'}
          </Button>
        </div>
      </div>

      {extraction.isError && (
        <p className="mt-2 text-sm text-[var(--color-danger)]">
          {extraction.error instanceof Error ? extraction.error.message : 'Failed to extract knowledge from this document.'}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : !hasResults ? (
        <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
          {extraction.isPending
            ? 'Extracting concepts, entities, and relationships…'
            : 'No knowledge extracted yet for this document.'}
        </p>
      ) : (
        <>
          {extraction.isPending && (
            <p className="mt-1.5 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <Spinner size="sm" /> Re-analyzing — current results stay visible until this finishes.
            </p>
          )}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {nodes.map((node) => (
              <KnowledgeCard
                key={node.id}
                title={node.title}
                typeLabel={node.node_type === 'concept' ? 'Concept' : 'Entity'}
                description={node.description}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
