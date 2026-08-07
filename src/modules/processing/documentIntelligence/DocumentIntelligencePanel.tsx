import { useRunDocumentIntelligence } from '@/modules/processing/documentIntelligence/useDocumentIntelligence'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import type { DocumentIntelligence } from '@/shared/types/database'

/**
 * Multimodal Intelligence v1 — mirrors KnowledgeExtractionPanel's shape
 * exactly (relabeling button, error line, empty state, TanStack cache
 * keeping stale results visible during a re-analyze) for the same
 * "Document Intelligence" section of Document Detail.
 */
export function DocumentIntelligencePanel({
  documentId,
  documentIntelligence,
}: {
  documentId: string
  documentIntelligence: DocumentIntelligence | null
}) {
  const run = useRunDocumentIntelligence(documentId)
  const hasResults = documentIntelligence !== null

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Document Intelligence</h2>
        <Button variant="secondary" loading={run.isPending} onClick={() => run.mutate()}>
          {hasResults ? 'Re-analyze' : 'Analyze Document Intelligence'}
        </Button>
      </div>

      {run.isError && (
        <p className="mt-2 text-sm text-[var(--color-danger)]">
          {run.error instanceof Error ? run.error.message : 'Failed to analyze this document.'}
        </p>
      )}

      {run.isPending && !hasResults ? (
        <div className="mt-2 flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : !hasResults ? (
        <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">No document intelligence generated yet for this document.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-[var(--color-ink)]">
            Classified as <span className="font-medium">{documentIntelligence.documentType}</span>
          </p>

          {documentIntelligence.dates.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-ink-muted)]">Important dates</p>
              <ul className="mt-1 flex flex-col gap-1">
                {documentIntelligence.dates.map((d, i) => (
                  <li key={i} className="text-sm text-[var(--color-ink)]">
                    <span className="text-[var(--color-ink-muted)]">{d.label}:</span> {d.date}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {documentIntelligence.decisions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-ink-muted)]">Decisions</p>
              <ul className="mt-1 flex list-inside list-disc flex-col gap-1">
                {documentIntelligence.decisions.map((decision, i) => (
                  <li key={i} className="text-sm text-[var(--color-ink)]">
                    {decision}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {documentIntelligence.tasks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-ink-muted)]">Tasks</p>
              <ul className="mt-1 flex flex-col gap-1">
                {documentIntelligence.tasks.map((task, i) => (
                  <li key={i} className="text-sm text-[var(--color-ink)]">
                    {task.description}
                    {task.owner && <span className="text-[var(--color-ink-muted)]"> — {task.owner}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {documentIntelligence.dates.length === 0 && documentIntelligence.decisions.length === 0 && documentIntelligence.tasks.length === 0 && (
            <p className="text-sm text-[var(--color-ink-muted)]">No dates, decisions, or tasks found in this document.</p>
          )}
        </div>
      )}
    </div>
  )
}
