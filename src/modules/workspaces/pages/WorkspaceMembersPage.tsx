import { Link, useParams } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { WorkspaceMemberRoster } from '@/modules/workspaces/components/WorkspaceMemberRoster'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'

/**
 * UX-14.5 Phase 3 — the Workspace Settings page for member
 * administration, reachable per-workspace-id regardless of which
 * workspace is currently active (unlike /collaboration, UX-14.5.7,
 * which always targets the *current* workspace). Body extracted into
 * WorkspaceMemberRoster so the same invite/roster/role-change/remove UI
 * is shared with the new consolidated Collaboration page rather than
 * duplicated.
 */
export function WorkspaceMembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { workspaces } = useWorkspace()
  const workspace = workspaces.find((w) => w.id === workspaceId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/settings/workspaces"
          className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          ← Back to Workspaces
        </Link>
        <div className="mt-2">
          <SectionHeader
            level="page"
            title={workspace ? `${workspace.name} — Members` : 'Members'}
            description="Everyone with access to this workspace, and their role."
          />
        </div>
      </div>

      <WorkspaceMemberRoster workspaceId={workspaceId!} />
    </div>
  )
}
