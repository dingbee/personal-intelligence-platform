import { useState } from 'react'
import { useWorkspaceObjectives } from '@/modules/hub/hooks/useWorkspaceObjectives'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'

/**
 * UX-13.7 — a simple, user-authored objectives checklist for one
 * workspace: content + active/done/dismissed status. Not AI-generated,
 * no due dates — the smallest honest version of "workspace objectives,"
 * consistent with this project's rule against shipping controls that
 * don't do anything real.
 */
export function WorkspaceObjectivesSection({ workspaceId }: { workspaceId: string | null }) {
  const { data: objectives = [], isLoading, create, setStatus, remove } = useWorkspaceObjectives(workspaceId)
  const [adding, setAdding] = useState(false)

  const active = objectives.filter((o) => o.status === 'active')
  const done = objectives.filter((o) => o.status === 'done')

  if (isLoading) return null

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
                <button
                  type="button"
                  onClick={() => setStatus.mutate({ id: objective.id, status: 'done' })}
                  className="text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-accent)]"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(objective.id)}
                  className="text-[var(--color-ink-muted)] transition-colors hover:text-red-600"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
          {done.map((objective) => (
            <li key={objective.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-[var(--color-ink-muted)]">
              <span className="min-w-0 truncate line-through">{objective.content}</span>
              <button
                type="button"
                onClick={() => remove.mutate(objective.id)}
                className="shrink-0 text-xs transition-colors hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <InlineTextForm
          placeholder="What is this workspace trying to accomplish?"
          onSubmit={(content) => {
            create.mutate(content)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + Add objective
        </Button>
      )}
    </div>
  )
}
