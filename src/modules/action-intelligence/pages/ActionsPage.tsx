import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useHasActionIntelligence } from '@/modules/plans/hooks/useHasActionIntelligence'
import { useActionIntelligence } from '@/modules/action-intelligence/hooks/useActionIntelligence'
import { useSaveActionSetToNote } from '@/modules/action-intelligence/hooks/useSaveActionSetToNote'
import { useAddActionAsWorkspaceObjective } from '@/modules/action-intelligence/hooks/useAddActionAsWorkspaceObjective'
import { useLinkActionToWorkspaceObjective } from '@/modules/action-intelligence/hooks/useLinkActionToWorkspaceObjective'
import { useWorkspaceObjectives } from '@/modules/hub/hooks/useWorkspaceObjectives'
import { formatActionSetAsNoteContent, formatActionAsText } from '@/modules/action-intelligence/api/formatActionSetAsNoteContent'
import type { Action, ActionReadinessState, ActionSet, ActionType } from '@/modules/action-intelligence/action'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'error' | 'neutral'

const READINESS_BADGE: Record<ActionReadinessState, { label: string; variant: BadgeVariant }> = {
  ready: { label: 'Ready', variant: 'success' },
  partially_ready: { label: 'Partially ready', variant: 'info' },
  blocked: { label: 'Blocked', variant: 'error' },
  needs_information: { label: 'Needs information', variant: 'warning' },
  needs_decision: { label: 'Needs a decision', variant: 'warning' },
}

const TYPE_LABEL: Record<ActionType, string> = {
  action: 'Action',
  task: 'Task',
  follow_up: 'Follow-up',
  information_request: 'Information request',
  decision_required: 'Decision required',
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

function ActionCard({
  action,
  workspaceId,
}: {
  action: Action
  workspaceId: string | null
}) {
  const [copied, setCopied] = useState(false)
  const addObjectiveMutation = useAddActionAsWorkspaceObjective(workspaceId)
  const readinessBadge = READINESS_BADGE[action.readiness.state]
  const actorLabel = action.actor.type === 'unassigned' ? 'Unassigned' : (action.actor.label ?? action.actor.type)

  async function handleCopy() {
    await copyText(formatActionAsText(action))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <li className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge label={TYPE_LABEL[action.type]} variant="neutral" />
        <StatusBadge label={readinessBadge.label} variant={readinessBadge.variant} />
        <StatusBadge label={`Priority: ${action.priority}`} variant="neutral" />
      </div>

      <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{action.title}</p>
      <p className="mt-0.5 text-[var(--color-ink-muted)]">{action.description}</p>

      <p className="mt-1.5 text-[var(--color-ink-muted)]">
        Responsible: <span className="text-[var(--color-ink)]">{actorLabel}</span>
        {action.dueHint && <span> — Timing: {action.dueHint}</span>}
      </p>

      {action.readiness.blockers.length > 0 && (
        <div className="mt-1.5">
          <p className="font-medium text-[var(--color-warning-strong)]">Blockers</p>
          <ul className="mt-0.5 flex flex-col gap-0.5 text-[var(--color-ink-muted)]">
            {action.readiness.blockers.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {action.readiness.missingInformation.length > 0 && (
        <div className="mt-1.5">
          <p className="font-medium text-[var(--color-warning-strong)]">Missing information</p>
          <ul className="mt-0.5 flex flex-col gap-0.5 text-[var(--color-ink-muted)]">
            {action.readiness.missingInformation.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        </div>
      )}

      {action.dependencies.length > 0 && (
        <div className="mt-1.5">
          <p className="font-medium text-[var(--color-ink-muted)]">Dependencies</p>
          <ul className="mt-0.5 flex flex-col gap-0.5 text-[var(--color-ink-muted)]">
            {action.dependencies.map((d) => (
              <li key={d.id}>
                • [{d.kind}] {d.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-1.5 text-[var(--color-ink-muted)]">Expected outcome: {action.expectedOutput.outcome}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)]"
        >
          {copied ? 'Copied' : 'Copy action'}
        </button>
        <button
          type="button"
          onClick={() => addObjectiveMutation.mutate(action)}
          disabled={!workspaceId || addObjectiveMutation.isPending}
          className="rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)] disabled:opacity-50"
        >
          {addObjectiveMutation.isSuccess ? 'Added' : '+ Workspace objective'}
        </button>
      </div>
      {addObjectiveMutation.isError && (
        <p role="alert" className="mt-1 text-[10px] text-[var(--color-danger)]">
          {errorMessage(addObjectiveMutation.error, 'Failed to add.')}
        </p>
      )}
    </li>
  )
}

/**
 * Action Intelligence — the minimum professional UI necessary to exercise
 * a bounded, single-pass action-readiness analysis, mirroring
 * DecisionPage.tsx/PlanningPage.tsx's own conventions. The central design
 * requirement (sprint brief Phase 13) is that READY is never visually
 * conflated with "recommended" or "generated" — every action always shows
 * its own readiness badge, blockers, and missing information alongside it,
 * and there is no button anywhere on this page that claims to execute an
 * action (Phase 12's explicit prohibition on fake execution affordances).
 */
export function ActionsPage() {
  const { currentWorkspaceId } = useWorkspace()
  const { data: hasActionIntelligence, isLoading: isCheckingEntitlement } = useHasActionIntelligence()
  const { data: objectives } = useWorkspaceObjectives(currentWorkspaceId)

  const [instruction, setInstruction] = useState('')
  const [objective, setObjective] = useState('')
  const [constraintsText, setConstraintsText] = useState('')
  const [actionSet, setActionSet] = useState<ActionSet | null>(null)
  const [linkTargetByAction, setLinkTargetByAction] = useState<Record<string, string>>({})
  const [actionSetCopied, setActionSetCopied] = useState(false)

  const mutation = useActionIntelligence(currentWorkspaceId)
  const saveMutation = useSaveActionSetToNote(currentWorkspaceId)
  const linkMutation = useLinkActionToWorkspaceObjective(currentWorkspaceId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!instruction.trim() && !objective.trim()) return
    setActionSet(null)
    saveMutation.reset()
    const userConstraints = constraintsText
      .split('\n')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
    const outcome = await mutation.mutateAsync({ instruction: instruction.trim() || null, objective: objective.trim() || null, userConstraints })
    setActionSet(outcome.actionSet)
  }

  async function handleCopySet() {
    if (!actionSet) return
    await copyText(formatActionSetAsNoteContent(actionSet))
    setActionSetCopied(true)
    setTimeout(() => setActionSetCopied(false), 1500)
  }

  function handleLink(action: Action) {
    const targetId = linkTargetByAction[action.id]
    const target = objectives?.find((o) => o.id === targetId)
    if (!target) return
    linkMutation.mutate({ objective: target, action })
  }

  const sortedActions = actionSet ? [...actionSet.actions].sort((a, b) => a.sequence - b.sequence) : []
  const readyCount = sortedActions.filter((a) => a.readiness.state === 'ready').length

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        level="page"
        title="Actions"
        description="Give ARRIYIA a decision, a plan, or a direct instruction. It proposes what needs to happen next, in what order, by whom — and, unlike a plain to-do list, tells you honestly which actions are actually ready to act on versus blocked, missing information, or waiting on a decision."
        action={
          <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Pro Intelligence
          </span>
        }
      />

      <SurfaceCard className="flex flex-col gap-3">
        {isCheckingEntitlement ? (
          <Spinner size="sm" />
        ) : !hasActionIntelligence ? (
          <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
            <p>Actions is a Pro Intelligence capability.</p>
            <Link to="/pricing" className="text-[var(--color-accent)] hover:underline">
              Upgrade to Pro →
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. We're launching the lecturer-first rollout next month — what needs to happen?"
              rows={2}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Objective (optional) — what this set of actions serves"
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
              disabled={mutation.isPending || (!instruction.trim() && !objective.trim())}
              className="self-start rounded-control bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] disabled:opacity-50"
            >
              {mutation.isPending ? 'Analyzing…' : 'Generate actions'}
            </button>

            {mutation.isError && (
              <p role="alert" className="text-xs text-[var(--color-danger)]">
                {errorMessage(mutation.error, 'Failed to generate actions. Please try again.')}
              </p>
            )}
          </form>
        )}
      </SurfaceCard>

      {mutation.isPending && (
        <SurfaceCard className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          <Spinner size="sm" />
          <span>Assembling context and determining what's actually ready…</span>
        </SurfaceCard>
      )}

      {actionSet && (actionSet.status === 'declined' || actionSet.status === 'failed') && (
        <SurfaceCard className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
          {actionSet.declineReason}
        </SurfaceCard>
      )}

      {actionSet && actionSet.status === 'complete' && (
        <SurfaceCard className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">{actionSet.title}</h2>
              {actionSet.objective && <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">Objective: {actionSet.objective}</p>}
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                {readyCount} of {sortedActions.length} action(s) are actually ready to act on right now.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCopySet()}
              className="shrink-0 rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)]"
            >
              {actionSetCopied ? 'Copied' : 'Copy action set'}
            </button>
          </div>

          {actionSet.validationIssues.length > 0 && (
            <div className="rounded-control border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)] p-2.5 text-xs text-[var(--color-warning-strong)]">
              <p className="font-medium">This action set has structural issues:</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {actionSet.validationIssues.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {sortedActions.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Actions</h3>
              <ul className="flex flex-col gap-1.5">
                {sortedActions.map((action) => (
                  <ActionCard key={action.id} action={action} workspaceId={currentWorkspaceId} />
                ))}
              </ul>
            </section>
          )}

          {objectives && objectives.length > 0 && sortedActions.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Link an action to an existing objective</h3>
              <div className="flex flex-col gap-1.5">
                {sortedActions.map((action) => (
                  <div key={action.id} className="flex items-center gap-1.5 text-xs">
                    <span className="min-w-0 flex-1 truncate text-[var(--color-ink-muted)]">{action.title}</span>
                    <select
                      value={linkTargetByAction[action.id] ?? ''}
                      onChange={(e) => setLinkTargetByAction((prev) => ({ ...prev, [action.id]: e.target.value }))}
                      className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-1.5 py-1 text-[11px]"
                    >
                      <option value="">Select objective…</option>
                      {objectives.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.content.slice(0, 60)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleLink(action)}
                      disabled={!linkTargetByAction[action.id] || linkMutation.isPending}
                      className="shrink-0 rounded-control border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-muted)] disabled:opacity-50"
                    >
                      Link
                    </button>
                  </div>
                ))}
              </div>
              {linkMutation.isError && (
                <p role="alert" className="text-[10px] text-[var(--color-danger)]">
                  {errorMessage(linkMutation.error, 'Failed to link.')}
                </p>
              )}
            </section>
          )}

          {actionSet.contextEvidence.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Evidence</h3>
              <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
                {actionSet.contextEvidence.map((e) => (
                  <li key={e.id}>
                    [{e.type}] {e.title}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div>
            <button
              type="button"
              onClick={() => saveMutation.mutate(actionSet)}
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
