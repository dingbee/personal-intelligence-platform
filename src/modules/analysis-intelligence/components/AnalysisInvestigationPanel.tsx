import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHasAnalysisIntelligence } from '@/modules/plans/hooks/useHasAnalysisIntelligence'
import { useStructuredDatasets } from '@/modules/data-intelligence/hooks/useStructuredDatasets'
import { useAnalysisInvestigation } from '@/modules/analysis-intelligence/hooks/useAnalysisInvestigation'
import { MAX_INVESTIGATION_STEPS } from '@/modules/analysis-intelligence/api/runAnalysisInvestigation'
import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/**
 * Analysis Intelligence — the minimum UI necessary to exercise a
 * bounded, multi-step investigation: a question input, and a step list
 * that grows as each step actually completes (driven by
 * useAnalysisInvestigation's onStepComplete callback, never a fake
 * timer or simulated progress bar — `investigation` below is only ever
 * set to a snapshot the orchestration function itself produced after a
 * real step finished). Mirrors DataIntelligenceQueryPanel's locked/
 * loading/error-state conventions exactly. Renders nothing when the
 * document has no persisted structured dataset (same gating condition
 * as DataIntelligenceQueryPanel, both mounted together on Document
 * Detail).
 */
export function AnalysisInvestigationPanel({ documentId, workspaceId }: { documentId: string; workspaceId: string | null }) {
  const { data: hasAnalysisIntelligence, isLoading: isCheckingEntitlement } = useHasAnalysisIntelligence()
  const { data: datasets, isLoading: isLoadingDatasets } = useStructuredDatasets(documentId)
  const [question, setQuestion] = useState('')
  const [investigation, setInvestigation] = useState<AnalysisInvestigation | null>(null)

  const datasetId = datasets?.[0]?.id ?? null
  const mutation = useAnalysisInvestigation(datasetId ?? '', workspaceId)

  if (isLoadingDatasets) return null
  if (!datasets || datasets.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || !datasetId) return
    setInvestigation(null)
    const outcome = await mutation.mutateAsync({ question: question.trim(), onStepComplete: setInvestigation })
    setInvestigation(outcome.investigation)
  }

  return (
    <SurfaceCard className="flex flex-col gap-3">
      <SectionHeader
        level="section"
        title="Analysis Investigation"
        description={`Ask a "why" or "what's driving" question. ARRIYIA runs a bounded sequence of deterministic computations (up to ${MAX_INVESTIGATION_STEPS} steps) and synthesizes evidence-grounded findings — it never calculates the answer itself.`}
        action={
          <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Pro Intelligence
          </span>
        }
      />

      {isCheckingEntitlement ? (
        <Spinner size="sm" />
      ) : !hasAnalysisIntelligence ? (
        <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
          <p>Analysis Investigation is a Pro Intelligence capability.</p>
          <Link to="/pricing" className="text-[var(--color-accent)] hover:underline">
            Upgrade to Pro →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Why is the return rate high in the South?"
              className="min-w-0 flex-1 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={mutation.isPending || !question.trim()}
              className="shrink-0 rounded-control bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] disabled:opacity-50"
            >
              {mutation.isPending ? 'Investigating…' : 'Investigate'}
            </button>
          </form>

          {mutation.isError && (
            <p role="alert" className="text-xs text-[var(--color-danger)]">
              {errorMessage(mutation.error, 'Failed to run the investigation. Please try again.')}
            </p>
          )}

          {investigation && (
            <div className="flex flex-col gap-3">
              {investigation.status === 'declined' || investigation.status === 'failed' ? (
                <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
                  {investigation.declineReason}
                </div>
              ) : (
                <>
                  <ol className="flex flex-col gap-2">
                    {investigation.steps.map((step) => (
                      <li key={step.id} className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2.5 text-xs">
                        <p className="font-medium text-[var(--color-ink)]">
                          Step {step.index + 1} of {MAX_INVESTIGATION_STEPS} — {step.purpose}
                        </p>
                        {step.result.status === 'error' ? (
                          <p className="mt-1 text-[var(--color-danger)]">Failed: {step.result.error.message}</p>
                        ) : (
                          <ul className="mt-1 flex flex-col gap-0.5 text-[var(--color-ink-muted)]">
                            {step.observations.map((o) => (
                              <li key={o.id}>{o.statement}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>

                  {investigation.contradictions.length > 0 && (
                    <div className="rounded-control border border-[var(--color-warning,var(--color-border))] bg-[var(--surface-inset)] p-2.5 text-xs text-[var(--color-ink-muted)]">
                      {investigation.contradictions.map((c) => (
                        <p key={c.id}>{c.description}</p>
                      ))}
                    </div>
                  )}

                  {investigation.status === 'complete' && investigation.synthesis && (
                    <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink)]">
                      <p className="whitespace-pre-wrap">{investigation.synthesis}</p>
                      {investigation.stepLimitReached && (
                        <p className="mt-2 text-xs font-medium text-[var(--color-ink-muted)]">Investigation depth was limited by the step budget.</p>
                      )}
                    </div>
                  )}

                  {investigation.status === 'in_progress' && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                      <Spinner size="sm" />
                      <span>Investigating…</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </SurfaceCard>
  )
}
