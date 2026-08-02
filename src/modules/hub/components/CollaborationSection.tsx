import { Link } from 'react-router-dom'
import type { NoteWithDocument } from '@/modules/notes/api/notes'
import type { Conversation } from '@/shared/types/database'
import type { DirectoryMember } from '@/shared/components/collaboration/MemberAvatarStack'
import { MemberAvatarStack } from '@/shared/components/collaboration/MemberAvatarStack'
import { MemberAvatar } from '@/shared/components/collaboration/MemberAvatar'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

interface ActivityItem {
  key: string
  href: string
  title: string
  updatedAt: string
  ownerId: string
}

/**
 * UX-14.5 Phase 5 — deliverable #6: a shared-workspace overview composed
 * entirely from data the Hub (and WorkspaceCard) already fetch. No new
 * queries: `members`/`lookup` come from useWorkspaceMemberDirectory
 * (already built this phase), `documentCount`/`noteCount`/`collectionCount`
 * come from useWorkspaceStats (the same hook WorkspaceCard's stat grid
 * uses), and `recentNotes`/`activeConversations` are the Hub's own
 * already-fetched lists — this just merges and re-sorts them into one
 * "recent activity" feed rather than issuing another round trip. Only
 * rendered when the workspace is actually shared (see call site).
 */
export function CollaborationSection({
  members,
  lookup,
  documentCount,
  noteCount,
  collectionCount,
  recentNotes,
  activeConversations,
}: {
  members: DirectoryMember[]
  lookup: (userId: string) => DirectoryMember | null
  documentCount: number
  noteCount: number
  collectionCount: number
  recentNotes: NoteWithDocument[]
  activeConversations: Conversation[]
}) {
  const activity: ActivityItem[] = [
    ...recentNotes.map((note) => ({
      key: `note-${note.id}`,
      href: `/notes/${note.id}`,
      title: note.title || 'Untitled note',
      updatedAt: note.updated_at,
      ownerId: note.user_id,
    })),
    ...activeConversations.map((conversation) => ({
      key: `conversation-${conversation.id}`,
      href: `/chat?conversationId=${conversation.id}`,
      title: conversation.title || 'Untitled conversation',
      updatedAt: conversation.updated_at,
      ownerId: conversation.user_id,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MemberAvatarStack members={members} />
          <span className="text-sm text-[var(--color-ink-muted)]">
            {members.length} member{members.length === 1 ? '' : 's'}
          </span>
        </div>
        <Link to="/settings/workspaces" className="text-sm text-[var(--color-accent)] hover:underline">
          Manage members →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard variant="inset" label={noteCount === 1 ? 'Shared note' : 'Shared notes'} value={noteCount} />
        <StatCard variant="inset" label={documentCount === 1 ? 'Shared document' : 'Shared documents'} value={documentCount} />
        <StatCard variant="inset" label={collectionCount === 1 ? 'Shared collection' : 'Shared collections'} value={collectionCount} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Recent activity</p>
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" description="Notes and conversations from this workspace will show up here." />
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.map((item) => {
              const owner = lookup(item.ownerId)
              return (
                <li key={item.key} className="flex items-center justify-between gap-4 text-sm">
                  <Link to={item.href} className="min-w-0 truncate text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                    {item.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                    {owner && <MemberAvatar displayName={owner.display_name} email={owner.email} size="sm" />}
                    {formatRelativeTime(item.updatedAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
