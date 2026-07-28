import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspaceManagement } from '@/modules/workspaces/hooks/useWorkspaceManagement'
import { WorkspaceCard } from '@/modules/workspaces/components/WorkspaceCard'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'

export function WorkspaceManagementPage() {
  const { data: workspaces = [], isLoading, create } = useWorkspaceManagement()
  const [creating, setCreating] = useState(false)

  const active = workspaces.filter((w) => !w.archived_at)
  const archived = workspaces.filter((w) => w.archived_at)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/settings" className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]">
          ← Back to Settings
        </Link>
        <div className="mt-2">
          <SectionHeader
            level="page"
            title="Workspaces"
            description={'Your mental spaces — rename, reorder, archive, or delete them. Deleting one never deletes its content, it moves to the unscoped "All" view.'}
          />
        </div>
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
              <SectionHeader level="section" title="Archived" />
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
