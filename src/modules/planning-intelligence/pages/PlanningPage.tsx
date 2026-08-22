import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useHasPlanningIntelligence } from '@/modules/plans/hooks/useHasPlanningIntelligence'
import { usePlanningIntelligence } from '@/modules/planning-intelligence/hooks/usePlanningIntelligence'
import { useRevisePlanningIntelligence } from '@/modules/planning-intelligence/hooks/useRevisePlanningIntelligence'
import { useSavePlanToNote } from '@/modules/planning-intelligence/hooks/useSavePlanToNote'
import { useAddPlanItemAsWorkspaceObjective } from '@/modules/planning-intelligence/hooks/useAddPlanItemAsWorkspaceObjective'
import type { InformationOrigin, Plan, PlanTaskStatus } from '@/modules/planning-intelligence/plan'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

const ORIGIN_BADGE: Record<InformationOrigin, { label: string; variant: 'success' | 'info' | 'warning' }> = {
  known: { label: 'Known', variant: 'success' },
  assumed: { label: 'Assumption', variant: 'info' },
  unknown: { label: 'Unknown', variant: 'warning' },
  requires_user_input: { label: 'Needs your input', variant: 'warning' },
}

const PRIORITY_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' }

const TASK_STATUS_LABEL: Record<PlanTaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const TASK_STATUS_OPTIONS: PlanTaskStatus[] = ['not_started', 'in_progress', 'blocked', 'completed', 'cancelled']

/**
 * Planning Intelligence — the minimum professional UI necessary to
 * exercise a bounded, single-pass plan generation, mirroring
 * ResearchPage/AnalysisInvestigationPanel's own conventions: an
 * objective input, real generated content only (no fake progress), and
 * explicit FACT/ASSUMPTION/UNKNOWN/DECISION/ACTION labeling throughout
 * (sprint brief, Phase 7) via StatusBadge rather than plain prose, so
 * the plan's own epistemic distinctions survive into the UI instead of
 * collapsing into one undifferentiated block of text.
 */
export function PlanningPage() {
  const { currentWorkspaceId } = useWorkspace()
  const { data: hasPlanningIntelligence, isLoading: isCheckingEntitlement } = useHasPlanningIntelligence()

  const [objective, setObjective] = useState('')
  const [constraintsText, setConstraintsText] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [revisionText, setRevisionText] = useState('')

  const mutation = usePlanningIntelligence(currentWorkspaceId)
  const revisionMutation = useRevisePlanningIntelligence(currentWorkspaceId)
  const saveMutation = useSavePlanToNote(currentWorkspaceId)
  const addObjectiveMutation = useAddPlanItemAsWorkspaceObjective(currentWorkspaceId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!objective.trim()) return
    setPlan(null)
    saveMutation.reset()
    revisionMutation.reset()
    const userConstraints = constraintsText
      .split('\n')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
    const outcome = await mutation.mutateAsync({ objective: objective.trim(), userConstraints })
    setPlan(outcome.plan)
  }

  async function handleRevise(e: React.FormEvent) {
    e.preventDefault()
    if (!plan || !revisionText.trim()) return
    saveMutation.reset()
    const outcome = await revisionMutation.mutateAsync({ plan, change: revisionText.trim() })
    setPlan(outcome.plan)
    setRevisionText('')
  }

  function handleTaskStatusChange(taskId: string, status: PlanTaskStatus) {
    setPlan((current) => (current ? { ...current, tasks: current.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) } : current))
  }

  const milestoneById = new Map((plan?.milestones ?? []).map((m) => [m.id, m]))
  const workstreamById = new Map((plan?.workstreams ?? []).map((w) => [w.id, w]))
  const resourceById = new Map((plan?.resources ?? []).map((r) => [r.id, r]))
  const criticalPathIds = new Set(plan?.criticalPath ?? [])

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        level="page"
        title="Planning"
        description="Give ARRIYIA an objective. It assembles relevant context from your workspace and produces a structured, inspectable plan — milestones, tasks, dependencies, risks, and decisions — distinguishing what it knows from what it assumed or doesn't know. It never invents a deadline, budget, or resource you didn't provide."
        action={
          <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Pro Intelligence
          </span>
        }
      />

      <SurfaceCard className="flex flex-col gap-3">
        {isCheckingEntitlement ? (
          <Spinner size="sm" />
        ) : !hasPlanningIntelligence ? (
          <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
            <p>Planning is a Pro Intelligence capability.</p>
            <Link to="/pricing" className="text-[var(--color-accent)] hover:underline">
              Upgrade to Pro →
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Launch our new pricing page before the end of the quarter"
              rows={2}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <textarea
              value={constraintsText}
              onChange={(e) => setConstraintsText(e.target.value)}
              placeholder="Constraints, one per line (optional) — e.g. no additional budget, must ship before June"
              rows={2}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={mutation.isPending || !objective.trim()}
              className="self-start rounded-control bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] disabled:opacity-50"
            >
              {mutation.isPending ? 'Planning…' : 'Generate plan'}
            </button>

            {mutation.isError && (
              <p role="alert" className="text-xs text-[var(--color-danger)]">
                {errorMessage(mutation.error, 'Failed to generate a plan. Please try again.')}
              </p>
            )}
          </form>
        )}
      </SurfaceCard>

      {mutation.isPending && (
        <SurfaceCard className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Spinner size="sm" />
          <span>Assembling context and reasoning about the plan…</span>
        </SurfaceCard>
      )}

      {plan && (plan.status === 'declined' || plan.status === 'failed') && (
        <SurfaceCard className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
          {plan.declineReason}
        </SurfaceCard>
      )}

      {plan && plan.status === 'complete' && (
        <SurfaceCard className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">{plan.title}</h2>
            {plan.description && <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{plan.description}</p>}
          </div>

          {plan.validationIssues.length > 0 && (
            <div className="rounded-control border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)] p-2.5 text-xs text-[var(--color-warning-strong)]">
              <p className="font-medium">This plan has structural issues:</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {plan.validationIssues.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {(plan.currentState || plan.desiredOutcome || plan.gapAnalysis) && (
            <div className="flex flex-col gap-1 text-sm text-[var(--color-ink)]">
              {plan.currentState && (
                <p>
                  <span className="font-medium">Current state:</span> {plan.currentState}
                </p>
              )}
              {plan.desiredOutcome && (
                <p>
                  <span className="font-medium">Desired outcome:</span> {plan.desiredOutcome}
                </p>
              )}
              {plan.gapAnalysis && (
                <p>
                  <span className="font-medium">Gap:</span> {plan.gapAnalysis}
                </p>
              )}
              {plan.deadline && (
                <p>
                  <span className="font-medium">Deadline:</span> {plan.deadline}
                </p>
              )}
              {plan.revisionOf && (
                <p className="text-[var(--color-ink-muted)]">
                  <span className="font-medium">Revised:</span> {plan.revisionReason}
                </p>
              )}
            </div>
          )}

          {plan.objectives.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Objectives</h3>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink)]">
                {plan.objectives.map((o) => (
                  <li key={o.id} className="flex items-start gap-2">
                    <StatusBadge label={o.origin === 'known' ? 'Known' : 'Assumption'} variant={o.origin === 'known' ? 'success' : 'info'} />
                    <span>{o.statement}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.workstreams.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Workstreams</h3>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink)]">
                {plan.workstreams.map((w) => (
                  <li key={w.id}>
                    <span className="font-medium">{w.title}</span>
                    {w.description && <span className="text-[var(--color-ink-muted)]"> — {w.description}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.resources.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Resources</h3>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink)]">
                {plan.resources.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.name}</span> ({r.kind}
                    {r.capacity !== null ? `, capacity: ${r.capacity}${r.unit ? ` ${r.unit}` : ''}` : ', capacity unknown'})
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.milestones.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Milestones</h3>
              <ol className="flex flex-col gap-1.5">
                {[...plan.milestones]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((m) => (
                    <li key={m.id} className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-[var(--color-ink)]">
                          {m.sequence}. {m.title}
                          {m.targetDate && <span className="ml-2 font-normal text-[var(--color-ink-muted)]">({m.targetDate})</span>}
                          {!m.targetDate && m.target && <span className="ml-2 font-normal text-[var(--color-ink-muted)]">({m.target})</span>}
                        </p>
                        <button
                          type="button"
                          onClick={() => addObjectiveMutation.mutate({ title: m.title, description: m.description })}
                          disabled={!currentWorkspaceId || addObjectiveMutation.isPending}
                          className="shrink-0 rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)] disabled:opacity-50"
                        >
                          + Workspace objective
                        </button>
                      </div>
                      <p className="mt-0.5 text-[var(--color-ink-muted)]">{m.description}</p>
                      {m.dependsOnMilestoneIds.length > 0 && (
                        <p className="mt-0.5 text-[var(--color-ink-muted)]">
                          Depends on: {m.dependsOnMilestoneIds.map((id) => milestoneById.get(id)?.title ?? id).join(', ')}
                        </p>
                      )}
                    </li>
                  ))}
              </ol>
            </section>
          )}

          {plan.tasks.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Tasks (Actions)</h3>
              <ol className="flex flex-col gap-1.5">
                {[...plan.tasks]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((t) => (
                    <li key={t.id} className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-[var(--color-ink)]">
                          <StatusBadge label={PRIORITY_LABEL[t.priority] ?? t.priority} variant={t.priority === 'high' ? 'error' : t.priority === 'medium' ? 'info' : 'neutral'} />{' '}
                          {criticalPathIds.has(t.id) && <StatusBadge label="Critical path" variant="warning" />} {t.title}
                          {t.milestoneId && <span className="ml-2 font-normal text-[var(--color-ink-muted)]">({milestoneById.get(t.milestoneId)?.title ?? 'milestone'})</span>}
                          {t.workstreamId && <span className="ml-2 font-normal text-[var(--color-ink-muted)]">[{workstreamById.get(t.workstreamId)?.title ?? 'workstream'}]</span>}
                        </p>
                        <select
                          value={t.status}
                          onChange={(e) => handleTaskStatusChange(t.id, e.target.value as PlanTaskStatus)}
                          className="shrink-0 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-1.5 py-1 text-[10px] text-[var(--color-ink)]"
                        >
                          {TASK_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-0.5 text-[var(--color-ink-muted)]">{t.description}</p>
                      {t.dependsOnTaskIds.length > 0 && (
                        <p className="mt-0.5 text-[var(--color-ink-muted)]">
                          Depends on: {t.dependsOnTaskIds.map((id) => plan.tasks.find((x) => x.id === id)?.title ?? id).join(', ')}
                        </p>
                      )}
                      {(t.estimatedEffort || t.requiredResources.length > 0 || t.resourceRequirements.length > 0) && (
                        <p className="mt-0.5 text-[var(--color-ink-muted)]">
                          {t.estimatedEffort && <>Est: {t.estimatedEffort}. </>}
                          {t.requiredResources.length > 0 && <>Needs: {t.requiredResources.join(', ')}. </>}
                          {t.resourceRequirements.length > 0 && (
                            <>Uses: {t.resourceRequirements.map((rr) => `${rr.amount} ${resourceById.get(rr.resourceId)?.name ?? rr.resourceId}`).join(', ')}.</>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
              </ol>
            </section>
          )}

          {plan.assumptions.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Assumptions</h3>
              <ul className="flex flex-col gap-1">
                {plan.assumptions.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-xs text-[var(--color-ink)]">
                    <StatusBadge label={ORIGIN_BADGE[a.origin].label} variant={ORIGIN_BADGE[a.origin].variant} />
                    <span>{a.statement}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.constraints.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Constraints</h3>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink)]">
                {plan.constraints.map((c) => (
                  <li key={c.id}>
                    <StatusBadge label={c.severity === 'hard' ? 'Hard' : 'Soft'} variant={c.severity === 'hard' ? 'error' : 'neutral'} /> {c.constraint}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.risks.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Risks</h3>
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink)]">
                {plan.risks.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.risk}</span> (impact: {r.impact}
                    {r.probability ? `, probability: ${r.probability}` : ''}){r.mitigation && <> — mitigation: {r.mitigation}</>}
                    {r.contingency && <> — if it happens anyway: {r.contingency}</>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.decisions.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Decisions needed</h3>
              <ul className="flex flex-col gap-1.5 text-xs text-[var(--color-ink)]">
                {plan.decisions.map((d) => (
                  <li key={d.id} className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2">
                    <p>
                      <StatusBadge label={d.unresolved ? 'Unresolved decision' : 'Decision'} variant={d.unresolved ? 'warning' : 'info'} /> {d.decision}
                    </p>
                    {d.options.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 text-[var(--color-ink-muted)]">
                        {d.options.map((o, i) => (
                          <li key={i}>
                            • {o.option}
                            {o.tradeoff && ` — ${o.tradeoff}`}
                          </li>
                        ))}
                      </ul>
                    )}
                    {d.recommendation && (
                      <p className="mt-1 text-[var(--color-ink-muted)]">
                        <span className="font-medium">Recommendation:</span> {d.recommendation}{' '}
                        {d.decisionIntelligence ? (
                          <StatusBadge label="Via Decision Intelligence" variant="success" />
                        ) : (
                          <StatusBadge label="Planning's own estimate" variant="neutral" />
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(plan.outputs.length > 0 || plan.successCriteria.length > 0) && (
            <section className="flex flex-col gap-1.5">
              {plan.outputs.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Expected outputs</h3>
                  <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink)]">
                    {plan.outputs.map((o) => (
                      <li key={o.id}>
                        • {o.deliverable} <span className="text-[var(--color-ink-muted)]">(done when: {o.completionCriteria})</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {plan.successCriteria.length > 0 && (
                <>
                  <h3 className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Success criteria</h3>
                  <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink)]">
                    {plan.successCriteria.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          <div>
            <button
              type="button"
              onClick={() => saveMutation.mutate(plan)}
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

          <form onSubmit={(e) => void handleRevise(e)} className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Revise this plan</h3>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Describe one real change — a shortened deadline, a removed resource, a delayed dependency — and ARRIYIA will update only what
              the change actually affects, preserving the rest.
            </p>
            <textarea
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              placeholder="e.g. The deadline moved up to next Friday"
              rows={2}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={revisionMutation.isPending || !revisionText.trim()}
              className="self-start rounded-control border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] disabled:opacity-50"
            >
              {revisionMutation.isPending ? 'Revising…' : 'Revise plan'}
            </button>
            {revisionMutation.isError && (
              <p role="alert" className="text-xs text-[var(--color-danger)]">
                {errorMessage(revisionMutation.error, 'Failed to revise the plan. Please try again.')}
              </p>
            )}
          </form>
        </SurfaceCard>
      )}
    </div>
  )
}
