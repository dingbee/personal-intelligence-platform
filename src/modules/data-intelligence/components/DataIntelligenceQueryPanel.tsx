import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHasDataIntelligence } from '@/modules/plans/hooks/useHasDataIntelligence'
import { useStructuredDatasets } from '@/modules/data-intelligence/hooks/useStructuredDatasets'
import { useDataIntelligenceQuery } from '@/modules/data-intelligence/hooks/useDataIntelligenceQuery'
import type { DataIntelligenceQueryOutcome } from '@/modules/data-intelligence/api/runDataIntelligenceQuery'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/**
 * Data Intelligence Foundation — the minimum UI necessary to exercise the
 * new capability: a question input over a persisted structured dataset,
 * not a spreadsheet analytics application. Mirrors WorkspaceBriefingCard's
 * exact locked/loading/error-state conventions. Renders nothing when the
 * document has no persisted structured dataset yet (documents processed
 * before this phase, or a non-spreadsheet document never queried here in
 * the first place — DocumentDetailPage only mounts this alongside
 * SpreadsheetSummaryCard).
 */
export function DataIntelligenceQueryPanel({ documentId, workspaceId }: { documentId: string; workspaceId: string | null }) {
  const { data: hasDataIntelligence, isLoading: isCheckingEntitlement } = useHasDataIntelligence()
  const { data: datasets, isLoading: isLoadingDatasets } = useStructuredDatasets(documentId)
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [outcome, setOutcome] = useState<DataIntelligenceQueryOutcome | null>(null)

  const activeDatasetId = selectedDatasetId ?? datasets?.[0]?.id ?? null
  const query = useDataIntelligenceQuery(activeDatasetId ?? '', workspaceId)

  if (isLoadingDatasets) return null
  if (!datasets || datasets.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || !activeDatasetId) return
    const result = await query.mutateAsync(question.trim())
    setOutcome(result)
  }

  return (
    <SurfaceCard className="flex flex-col gap-3">
      <SectionHeader
        level="section"
        title="Data Intelligence Query"
        description="Ask a question about this dataset. A deterministic engine computes the answer; the AI only interprets the verified result."
        action={
          <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Pro Intelligence
          </span>
        }
      />

      {isCheckingEntitlement ? (
        <Spinner size="sm" />
      ) : !hasDataIntelligence ? (
        <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
          <p>Data Intelligence Query is a Pro Intelligence capability.</p>
          <Link to="/pricing" className="text-[var(--color-accent)] hover:underline">
            Upgrade to Pro →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {datasets.length > 1 && (
            <select
              value={activeDatasetId ?? ''}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2 py-1 text-sm"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.sheetName} ({d.rowCount} rows)
                </option>
              ))}
            </select>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which salesperson generated the most total sales?"
              className="min-w-0 flex-1 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={query.isPending || !question.trim()}
              className="shrink-0 rounded-control bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] disabled:opacity-50"
            >
              {query.isPending ? 'Computing…' : 'Ask'}
            </button>
          </form>

          {query.isError && (
            <p role="alert" className="text-xs text-[var(--color-danger)]">
              {errorMessage(query.error, 'Failed to answer the question. Please try again.')}
            </p>
          )}

          {outcome && (
            <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink)]">
              {outcome.status === 'answered' ? (
                <p className="whitespace-pre-wrap">{outcome.answer}</p>
              ) : (
                <p className="text-[var(--color-ink-muted)]">{outcome.reason}</p>
              )}
            </div>
          )}
        </div>
      )}
    </SurfaceCard>
  )
}
