import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useWorkspaceMemberDirectory } from '@/modules/workspaces/hooks/useWorkspaceMemberDirectory'
import { useWorkspaceStats } from '@/modules/workspaces/hooks/useWorkspaceStats'
import { WorkspaceMemberRoster } from '@/modules/workspaces/components/WorkspaceMemberRoster'
import { CollaborationSection } from '@/modules/hub/components/CollaborationSection'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Spinner } from '@/shared/components/ui/Spinner'

const RECENT_LIST_LIMIT = 5

/**
 * UX-14.5.7 — Collaboration Command Center: the one destination for
 * "who's in this workspace, what's shared, what's been happening,"
 * promoted from where Phase 5 first landed it (a section buried
 * partway down the Hub, only visible when already shared) into a real
 * route with its own nav entry. Consolidates what were three separate
 * discovery paths — the Hub's Collaboration section, the standalone
 * Settings members page, and no dedicated overview at all — into one
 * page: full member management (WorkspaceMemberRoster, reused unchanged
 * from Settings) plus shared-intelligence stats and recent activity
 * (CollaborationSection, reused unchanged from the Hub). Deliberately
 * lightweight compared to the Hub's own data hook (useWorkspaceHub) —
 * this page only needs member/stat/activity data, not the full
 * evolution report/concept graph/recommendations composition, so it
 * fetches its own small, independent set of hooks rather than pulling
 * in unrelated computation.
 */
export function WorkspaceCollaborationPage() {
  const { currentWorkspaceId, workspaces } = useWorkspace()
  const workspaceName = workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? 'This workspace'
  const { members, isShared, lookup, isLoading: membersLoading } = useWorkspaceMemberDirectory(currentWorkspaceId)
  const { data: stats } = useWorkspaceStats(currentWorkspaceId)
  const { data: recentNotes = [] } = useNotes({ limit: RECENT_LIST_LIMIT })
  const { data: conversations = [] } = useConversations()

  if (!currentWorkspaceId) {
    return (
      <EmptyState
        title="Select a workspace"
        description="Collaboration is a per-workspace destination — pick a workspace from the switcher above, or create one if you don't have one yet."
        action={
          <Link to="/settings/workspaces" className="text-sm text-[var(--color-accent)] hover:underline">
            Manage workspaces →
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        level="page"
        title="Collaboration"
        description={`Members, shared intelligence, and recent activity in ${workspaceName}.`}
      />

      {membersLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {isShared && stats ? (
            <CollaborationSection
              members={members}
              lookup={lookup}
              documentCount={stats.documents}
              noteCount={stats.notes}
              collectionCount={stats.collections}
              recentNotes={recentNotes}
              activeConversations={conversations.slice(0, RECENT_LIST_LIMIT)}
            />
          ) : (
            <EmptyState
              title={`${workspaceName} is personal`}
              description="Invite someone below to start sharing notes, documents, and collections in this workspace."
            />
          )}

          <section className="flex flex-col gap-3">
            <SectionHeader level="section" title="Members" description="Invite people and manage roles." />
            <WorkspaceMemberRoster workspaceId={currentWorkspaceId} />
          </section>
        </>
      )}
    </div>
  )
}
