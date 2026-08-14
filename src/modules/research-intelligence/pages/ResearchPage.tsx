import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useHasResearchIntelligence } from '@/modules/plans/hooks/useHasResearchIntelligence'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import { useResearchInvestigation } from '@/modules/research-intelligence/hooks/useResearchInvestigation'
import { useSaveResearchToNote } from '@/modules/research-intelligence/hooks/useSaveResearchToNote'
import { MAX_RESEARCH_STEPS } from '@/modules/research-intelligence/api/runResearchInvestigation'
import { collectDistinctSources } from '@/modules/research-intelligence/api/formatResearchForSynthesis'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  agrees_with: 'agrees with',
  differs_from: 'differs from',
  provides_additional_evidence: 'provides additional evidence for',
  uses_different_methodology: 'uses a different methodology than',
  cannot_be_directly_compared: 'cannot be directly compared with',
}

const GAP_REASON_LABELS: Record<string, string> = {
  insufficient_evidence: 'Insufficient evidence',
  conflicting_findings: 'Conflicting findings',
  methodological_limitation: 'Methodological limitation',
  missing_variable: 'Missing variable',
  unanswered_question: 'Unanswered question',
  outdated_evidence: 'Outdated evidence',
}

function stepStatusLabel(step: ResearchInvestigation['steps'][number]): string {
  if (step.kind === 'dataset_investigation') return `Analyzed the dataset: ${step.query}`
  return `Searched: "${step.query}"`
}

/**
 * Research Intelligence — the minimum professional UI necessary to
 * exercise a bounded, multi-step research investigation, distinct from
 * ordinary Chat: a question (with optional scope/context/document-scope)
 * input, and a step list that grows as each step actually completes
 * (driven by useResearchInvestigation's onStepComplete callback — never
 * a fake timer or simulated progress bar). Mirrors
 * AnalysisInvestigationPanel's locked/loading/error-state conventions.
 * Mobile-usable: single-column flex layout, no fixed widths, same
 * SurfaceCard/SectionHeader primitives every other page already uses
 * responsively.
 */
export function ResearchPage() {
  const { currentWorkspaceId } = useWorkspace()
  const { data: hasResearchIntelligence, isLoading: isCheckingEntitlement } = useHasResearchIntelligence()
  const { data: documents } = useDocuments({})

  const [question, setQuestion] = useState('')
  const [scope, setScope] = useState('')
  const [context, setContext] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [investigation, setInvestigation] = useState<ResearchInvestigation | null>(null)

  const mutation = useResearchInvestigation(currentWorkspaceId)
  const saveMutation = useSaveResearchToNote(currentWorkspaceId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setInvestigation(null)
    saveMutation.reset()
    const outcome = await mutation.mutateAsync({
      question: question.trim(),
      scope: scope.trim() || null,
      context: context.trim() || null,
      documentId: documentId || null,
      onStepComplete: setInvestigation,
    })
    setInvestigation(outcome.investigation)
  }

  const sources = investigation ? collectDistinctSources(investigation) : []

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        level="page"
        title="Research"
        description={`Ask a research question. ARRIYIA gathers evidence from your own library (up to ${MAX_RESEARCH_STEPS} bounded steps), optionally runs a real dataset analysis, and synthesizes findings — it never invents a source, and it never calculates a dataset result itself.`}
        action={
          <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Pro Intelligence
          </span>
        }
      />

      <SurfaceCard className="flex flex-col gap-3">
        {isCheckingEntitlement ? (
          <Spinner size="sm" />
        ) : !hasResearchIntelligence ? (
          <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
            <p>Research is a Pro Intelligence capability.</p>
            <Link to="/pricing" className="text-[var(--color-accent)] hover:underline">
              Upgrade to Pro →
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What appears to be associated with higher return rates?"
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Scope (optional)"
                className="min-w-0 flex-1 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Context (optional)"
                className="min-w-0 flex-1 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
              />
            </div>
            {documents && documents.length > 0 && (
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm text-[var(--color-ink-muted)]"
              >
                <option value="">Whole workspace (no document restriction)</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Focus on: {doc.title}
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={mutation.isPending || !question.trim()}
              className="self-start rounded-control bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] disabled:opacity-50"
            >
              {mutation.isPending ? 'Researching…' : 'Investigate'}
            </button>

            {mutation.isError && (
              <p role="alert" className="text-xs text-[var(--color-danger)]">
                {errorMessage(mutation.error, 'Failed to run the research investigation. Please try again.')}
              </p>
            )}
          </form>
        )}
      </SurfaceCard>

      {investigation && (
        <SurfaceCard className="flex flex-col gap-3">
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
                      Step {step.index + 1} of {MAX_RESEARCH_STEPS} — {step.purpose}
                    </p>
                    <p className="mt-0.5 text-[var(--color-ink-muted)]">{stepStatusLabel(step)}</p>
                    {step.evidence.length === 0 ? (
                      <p className="mt-1 text-[var(--color-ink-muted)]">No evidence found for this step.</p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-0.5 text-[var(--color-ink-muted)]">
                        {step.observations.length === 0 ? (
                          <li>Evidence found, but no supported observation could be drawn from it.</li>
                        ) : (
                          step.observations.map((o) => <li key={o.id}>{o.statement}</li>)
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>

              {sources.length > 0 && (
                <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2.5 text-xs text-[var(--color-ink-muted)]">
                  <p className="font-medium text-[var(--color-ink)]">Sources consulted</p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {sources.map((s) => (
                      <li key={`${s.type}:${s.id}`}>
                        <span>[{s.type === 'document' ? 'Document' : s.type === 'note' ? 'Note' : 'Dataset analysis'}]</span> <span>{s.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {investigation.comparisons.length > 0 && (
                <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2.5 text-xs text-[var(--color-ink-muted)]">
                  <p className="font-medium text-[var(--color-ink)]">Cross-source comparisons</p>
                  {investigation.comparisons.map((c) => {
                    const titles = c.sourceIds.map((id) => sources.find((s) => s.id === id)?.title ?? id)
                    return (
                      <p key={c.id} className="mt-1">
                        {titles.join(' ')} — <span className="font-medium">{RELATIONSHIP_LABELS[c.relationship] ?? c.relationship}</span>: {c.description}
                      </p>
                    )
                  })}
                </div>
              )}

              {investigation.status === 'complete' && (investigation.synthesis || investigation.synthesisFailed) && (
                <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink)]">
                  {investigation.synthesisFailed ? (
                    <p className="text-[var(--color-ink-muted)]">
                      ARRIYIA gathered the evidence above but could not generate a synthesis. The findings above are shown as-is.
                    </p>
                  ) : (
                    <>
                      {investigation.keyFindings.length > 0 && (
                        <ul className="mb-2 flex flex-col gap-1">
                          {investigation.keyFindings.map((f, i) => (
                            <li key={i} className="font-medium">
                              • {f}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="whitespace-pre-wrap">{investigation.synthesis}</p>
                      {investigation.limitations && (
                        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                          <span className="font-medium">Limitations:</span> {investigation.limitations}
                        </p>
                      )}
                      {investigation.gaps.length > 0 && (
                        <div className="mt-2 text-xs text-[var(--color-ink-muted)]">
                          <span className="font-medium">Research gaps:</span>
                          <ul className="mt-0.5">
                            {investigation.gaps.map((g) => (
                              <li key={g.id}>
                                ({GAP_REASON_LABELS[g.reason] ?? g.reason}) {g.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {investigation.followUpQuestions.length > 0 && (
                        <div className="mt-2 text-xs text-[var(--color-ink-muted)]">
                          <span className="font-medium">Follow-up questions:</span>
                          <ul className="mt-0.5">
                            {investigation.followUpQuestions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  {investigation.stepLimitReached && (
                    <p className="mt-2 text-xs font-medium text-[var(--color-ink-muted)]">Investigation depth was limited by the step budget.</p>
                  )}

                  <button
                    type="button"
                    onClick={() => saveMutation.mutate(investigation)}
                    disabled={saveMutation.isPending || saveMutation.isSuccess}
                    className="mt-3 rounded-control border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] disabled:opacity-50"
                  >
                    {saveMutation.isSuccess ? 'Saved to Notes' : saveMutation.isPending ? 'Saving…' : 'Save to Notes'}
                  </button>
                  {saveMutation.isError && (
                    <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                      {errorMessage(saveMutation.error, 'Failed to save.')}
                    </p>
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
        </SurfaceCard>
      )}
    </div>
  )
}
