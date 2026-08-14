import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useHasDecisionIntelligence } from '@/modules/plans/hooks/useHasDecisionIntelligence'
import { useDecisionIntelligence } from '@/modules/decision-intelligence/hooks/useDecisionIntelligence'
import { useSaveDecisionToNote } from '@/modules/decision-intelligence/hooks/useSaveDecisionToNote'
import { useAddNextActionAsWorkspaceObjective } from '@/modules/decision-intelligence/hooks/useAddNextActionAsWorkspaceObjective'
import type { Decision, InformationOrigin } from '@/modules/decision-intelligence/decision'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

const ORIGIN_BADGE: Record<InformationOrigin, { label: string; variant: 'success' | 'info' | 'warning' }> = {
  known: { label: 'Fact', variant: 'success' },
  assumed: { label: 'Assumption', variant: 'info' },
  unknown: { label: 'Unknown', variant: 'warning' },
  requires_user_input: { label: 'Needs your input', variant: 'warning' },
}

const CONFIDENCE_LABEL: Record<string, string> = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' }
const RISK_VARIANT: Record<string, 'success' | 'warning' | 'error'> = { low: 'success', medium: 'warning', high: 'error' }

/**
 * Decision Intelligence — the minimum professional UI necessary to
 * exercise a bounded, single-pass decision analysis, mirroring
 * PlanningPage.tsx's own conventions exactly: a question/objective/
 * constraints input, real generated content only, and explicit
 * FACT/ASSUMPTION/UNKNOWN/RECOMMENDATION/RISK/CONSTRAINT/ACTION
 * labeling via StatusBadge (sprint brief Phase 12) rather than plain
 * prose. The recommendation is visually prominent but the surrounding
 * confidence/provisional/validation-issue copy is never suppressed —
 * the interface must not imply certainty beyond the actual evidence.
 */
export function DecisionPage() {
  const { currentWorkspaceId } = useWorkspace()
  const { data: hasDecisionIntelligence, isLoading: isCheckingEntitlement } = useHasDecisionIntelligence()

  const [question, setQuestion] = useState('')
  const [objective, setObjective] = useState('')
  const [constraintsText, setConstraintsText] = useState('')
  const [decision, setDecision] = useState<Decision | null>(null)

  const mutation = useDecisionIntelligence(currentWorkspaceId)
  const saveMutation = useSaveDecisionToNote(currentWorkspaceId)
  const addObjectiveMutation = useAddNextActionAsWorkspaceObjective(currentWorkspaceId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setDecision(null)
    saveMutation.reset()
    const userConstraints = constraintsText
      .split('\n')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
    const outcome = await mutation.mutateAsync({ question: question.trim(), objective: objective.trim() || null, userConstraints })
    setDecision(outcome.decision)
  }

  const recommended = decision?.alternatives.find((a) => a.id === decision.recommendedAlternativeId) ?? null
  const rankedScores = decision ? [...decision.weightedScores].sort((a, b) => b.totalScore - a.totalScore) : []

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        level="page"
        title="Decisions"
        description="Give ARRIYIA a decision question. It weighs real alternatives against explicit criteria, computes a deterministic weighted score, and recommends an option — distinguishing facts from assumptions, and never claiming more certainty than the evidence supports."
        action={
          <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Pro Intelligence
          </span>
        }
      />

      <SurfaceCard className="flex flex-col gap-3">
        {isCheckingEntitlement ? (
          <Spinner size="sm" />
        ) : !hasDecisionIntelligence ? (
          <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
            <p>Decisions is a Pro Intelligence capability.</p>
            <Link to="/pricing" className="text-[var(--color-accent)] hover:underline">
              Upgrade to Pro →
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Should our launch be student-first, lecturer-first, or simultaneous?"
              rows={2}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Objective (optional) — what success looks like"
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <textarea
              value={constraintsText}
              onChange={(e) => setConstraintsText(e.target.value)}
              placeholder="Constraints, one per line (optional)"
              rows={2}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={mutation.isPending || !question.trim()}
              className="self-start rounded-control bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] disabled:opacity-50"
            >
              {mutation.isPending ? 'Analyzing…' : 'Analyze decision'}
            </button>

            {mutation.isError && (
              <p role="alert" className="text-xs text-[var(--color-danger)]">
                {errorMessage(mutation.error, 'Failed to analyze the decision. Please try again.')}
              </p>
            )}
          </form>
        )}
      </SurfaceCard>

      {mutation.isPending && (
        <SurfaceCard className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Spinner size="sm" />
          <span>Assembling context and analyzing alternatives…</span>
        </SurfaceCard>
      )}

      {decision && (decision.status === 'declined' || decision.status === 'failed') && (
        <SurfaceCard className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
          {decision.declineReason}
        </SurfaceCard>
      )}

      {decision && decision.status === 'complete' && (
        <SurfaceCard className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">{decision.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{decision.question}</p>
            {decision.objective && <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">Objective: {decision.objective}</p>}
          </div>

          {decision.validationIssues.length > 0 && (
            <div className="rounded-control border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)] p-2.5 text-xs text-[var(--color-warning-strong)]">
              <p className="font-medium">This decision has structural issues:</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {decision.validationIssues.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {recommended && (
            <div className="rounded-control border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label="Recommendation" variant="info" />
                {decision.confidence && <StatusBadge label={CONFIDENCE_LABEL[decision.confidence] ?? decision.confidence} variant={decision.confidence === 'high' ? 'success' : decision.confidence === 'medium' ? 'info' : 'neutral'} />}
                {decision.provisional && <StatusBadge label="Provisional" variant="warning" />}
              </div>
              <p className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{recommended.title}</p>
              {decision.rationale && <p className="mt-1 text-sm text-[var(--color-ink)]">{decision.rationale}</p>}
              {decision.provisionalReason && <p className="mt-2 text-xs text-[var(--color-warning-strong)]">{decision.provisionalReason}</p>}
            </div>
          )}

          {decision.alternatives.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Alternatives</h3>
              <ul className="flex flex-col gap-1.5">
                {decision.alternatives.map((a) => (
                  <li key={a.id} className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2.5 text-xs">
                    <p className="font-medium text-[var(--color-ink)]">
                      {a.title}
                      {a.id === decision.recommendedAlternativeId && <span className="ml-2 text-[var(--color-accent)]">★ Recommended</span>}
                    </p>
                    <p className="mt-0.5 text-[var(--color-ink-muted)]">{a.description}</p>
                    {a.advantages.length > 0 && <p className="mt-1 text-[var(--color-ink-muted)]">+ {a.advantages.join('; ')}</p>}
                    {a.disadvantages.length > 0 && <p className="text-[var(--color-ink-muted)]">− {a.disadvantages.join('; ')}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {decision.criteria.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Criteria</h3>
              <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink)]">
                {decision.criteria.map((c) => (
                  <li key={c.id}>
                    {c.name} <span className="text-[var(--color-ink-muted)]">(weight {c.weight}, {c.importance} importance)</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rankedScores.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Comparison (deterministically computed)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[var(--color-ink-muted)]">
                      <th className="pb-1 pr-2">Alternative</th>
                      <th className="pb-1 pr-2">Weighted score</th>
                      <th className="pb-1">Gaps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedScores.map((s) => {
                      const alt = decision.alternatives.find((a) => a.id === s.alternativeId)
                      return (
                        <tr key={s.alternativeId} className="border-t border-[var(--color-border)]">
                          <td className="py-1 pr-2 font-medium text-[var(--color-ink)]">{alt?.title ?? s.alternativeId}</td>
                          <td className="py-1 pr-2">{s.totalScore.toFixed(2)} / 10</td>
                          <td className="py-1 text-[var(--color-ink-muted)]">{s.missingCriterionIds.length > 0 ? `${s.missingCriterionIds.length} unscored criterion(a)` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {decision.tradeoffs.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Trade-offs</h3>
              <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink)]">
                {decision.tradeoffs.map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </section>
          )}

          {decision.risks.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Risks</h3>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink)]">
                {decision.risks.map((r) => (
                  <li key={r.id}>
                    <StatusBadge label="Risk" variant={RISK_VARIANT[r.impact] ?? 'neutral'} /> {r.description} (impact: {r.impact}
                    {r.likelihood ? `, likelihood: ${r.likelihood}` : ''}){r.mitigation && <> — mitigation: {r.mitigation}</>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {decision.assumptions.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Assumptions</h3>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink)]">
                {decision.assumptions.map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <StatusBadge label={ORIGIN_BADGE[a.origin].label} variant={ORIGIN_BADGE[a.origin].variant} />
                    <span>
                      {a.statement}
                      {a.impactIfFalse && <span className="text-[var(--color-ink-muted)]"> — if false: {a.impactIfFalse}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {decision.unknowns.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Unknowns</h3>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink)]">
                {decision.unknowns.map((u, i) => (
                  <li key={i}>
                    <StatusBadge label="Unknown" variant="warning" /> {u}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {decision.sensitivity.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Sensitivity</h3>
              <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
                {decision.sensitivity.map((s) => (
                  <li key={s.id}>• {s.description}</li>
                ))}
              </ul>
            </section>
          )}

          {decision.contextEvidence.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Evidence</h3>
              <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
                {decision.contextEvidence.map((e) => (
                  <li key={e.id}>
                    [{e.type}] {e.title}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {decision.nextAction && (
            <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2.5 text-xs text-[var(--color-ink)]">
              <div className="flex items-center justify-between gap-2">
                <p>
                  <StatusBadge label="Action" variant="neutral" /> {decision.nextAction}
                </p>
                <button
                  type="button"
                  onClick={() => addObjectiveMutation.mutate(decision.nextAction!)}
                  disabled={!currentWorkspaceId || addObjectiveMutation.isPending}
                  className="shrink-0 rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)] disabled:opacity-50"
                >
                  + Workspace objective
                </button>
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => saveMutation.mutate(decision)}
              disabled={saveMutation.isPending || saveMutation.isSuccess}
              className="rounded-control border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] disabled:opacity-50"
            >
              {saveMutation.isSuccess ? 'Saved to Notes' : saveMutation.isPending ? 'Saving…' : 'Save to Notes'}
            </button>
            {saveMutation.isError && (
              <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                {errorMessage(saveMutation.error, 'Failed to save.')}
              </p>
            )}
          </div>
        </SurfaceCard>
      )}
    </div>
  )
}
