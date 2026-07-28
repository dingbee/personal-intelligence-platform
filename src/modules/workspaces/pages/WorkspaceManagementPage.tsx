import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspaceManagement } from '@/modules/workspaces/hooks/useWorkspaceManagement'
import { WorkspaceCard } from '@/modules/workspaces/components/WorkspaceCard'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

export function WorkspaceManagementPage() {
  const { data: workspaces = [], isLoading, create } = useWorkspaceManagement()
  const [creating, setCreating] = useState(false)

  const active = workspaces.filter((w) => !w.archived_at)
  const archived = workspaces.filter((w) => w.archived_at)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/settings" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Back to Settings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Workspaces</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Rename, reorder, archive, or delete your workspaces. Deleting a workspace never deletes its content — it
          moves to the unscoped "All" view.
        </p>
      </div>

      {isLoading ? (
        <Spinner size="sm" />
      ) : workspaces.length === 0 ? (
        <EmptyState
          title="No workspaces yet"
          description="Workspaces let you split your library, notes, and conversations into separate contexts."
          action={
            creating ? (
              <InlineTextForm
                placeholder="Workspace name"
                onSubmit={(name) => {
                  create.mutate(name)
                  setCreating(false)
                }}
                onCancel={() => setCreating(false)}
              />
            ) : (
              <Button onClick={() => setCreating(true)}>New workspace</Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {active.map((workspace, index) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                isFirst={index === 0}
                isLast={index === active.length - 1}
              />
            ))}
          </div>

          {creating ? (
            <div className="max-w-sm">
              <InlineTextForm
                placeholder="Workspace name"
                onSubmit={(name) => {
                  create.mutate(name)
                  setCreating(false)
                }}
                onCancel={() => setCreating(false)}
              />
            </div>
          ) : (
            <Button variant="secondary" className="self-start" onClick={() => setCreating(true)}>
              + New workspace
            </Button>
          )}

          {archived.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">Archived</h2>
              {archived.map((workspace) => (
                <WorkspaceCard key={workspace.id} workspace={workspace} isFirst isLast />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
