import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspaceObjectives } from '@/modules/hub/hooks/useWorkspaceObjectives'
import { useHasProIntelligence } from '@/modules/plans/hooks/useHasProIntelligence'
import { useReviewWorkspaceObjectives } from '@/modules/workspace-intelligence/hooks/useReviewWorkspaceObjectives'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unable to review objectives. Please try again.'
}

/** UX-14.4 — user-authored objectives remain the source of truth. ARRIYIA
 * may review progress from recorded workspace evidence, but never changes
 * status/content or executes an action from this surface. */
export function WorkspaceObjectivesSection({ workspaceId }: { workspaceId: string | null }) {
  const { data: objectives = [], isLoading, create, setStatus, remove } = useWorkspaceObjectives(workspaceId)
  const { data: hasProIntelligence, isLoading: isCheckingEntitlement } = useHasProIntelligence()
  const review = useReviewWorkspaceObjectives()
  const [adding, setAdding] = useState(false)
  const [reviewText, setReviewText] = useState<string | null>(null)

  const active = objectives.filter((o) => o.status === 'active')
  const done = objectives.filter((o) => o.status === 'done')

  if (isLoading) return null

  async function handleReview() {
    const result = await review.mutateAsync()
    setReviewText(result)
  }

  return (
    <div className="flex flex-col gap-3">
      {active.length === 0 && done.length === 0 && !adding ? (
        <EmptyState title="No objectives yet" description="Add what this workspace is trying to accomplish." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {active.map((objective) => (
            <li key={objective.id} className="flex items-center justify-between gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-raised)] px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-[var(--color-ink)]">{objective.content}</span>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <button type="button" onClick={() => setStatus.mutate({ id: objective.id, status: 'done' })} className="text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-accent)]">Done</button>
                <button type="button" onClick={() => remove.mutate(objective.id)} className="text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-danger)]">Dismiss</button>
              </div>
            </li>
          ))}
          {done.map((objective) => (
            <li key={objective.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-[var(--color-ink-muted)]">
              <span className="min-w-0 truncate line-through">{objective.content}</span>
              <button type="button" onClick={() => remove.mutate(objective.id)} className="shrink-0 text-xs transition-colors hover:text-[var(--color-danger)]">Remove</button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <InlineTextForm
          placeholder="What is this workspace trying to accomplish?"
          onSubmit={(content) => { create.mutate(content); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setAdding(true)}>+ Add objective</Button>
          {active.length > 0 && !isCheckingEntitlement && hasProIntelligence && (
            <Button variant="secondary" onClick={() => void handleReview()} disabled={review.isPending}>
              {review.isPending ? 'Reviewing…' : 'Review with ARRIYIA'}
            </Button>
          )}
          {active.length > 0 && !isCheckingEntitlement && !hasProIntelligence && (
            <Link to="/pricing" className="text-xs text-[var(--color-accent)] hover:underline">Review with ARRIYIA · Pro Intelligence →</Link>
          )}
        </div>
      )}

      {reviewText && (
        <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Objective review</p>
            <button type="button" onClick={() => setReviewText(null)} className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">Dismiss</button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--color-ink)]">{reviewText}</p>
        </div>
      )}

      {review.isError && <p role="alert" className="text-xs text-[var(--color-danger)]">{errorMessage(review.error)}</p>}
      {review.isPending && <Spinner size="sm" />}
    </div>
  )
}
