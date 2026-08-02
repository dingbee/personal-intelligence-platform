import { MemberAvatar } from '@/shared/components/collaboration/MemberAvatar'
import type { DirectoryMember } from '@/shared/components/collaboration/MemberAvatarStack'

/**
 * UX-14.5 Phase 5 — deliverable #2: "Owned by"/"Shared by" indicators.
 * `owner` comes from `useWorkspaceMemberDirectory`'s lookup — if it's
 * null (still loading, or the owner is no longer an active member),
 * this renders nothing rather than a broken or misleading line; a
 * missing indicator is a smaller UX cost than a wrong one.
 */
export function OwnershipLine({
  ownerId,
  currentUserId,
  owner,
  isShared,
}: {
  ownerId: string
  currentUserId: string | undefined
  owner: DirectoryMember | null
  isShared: boolean
}) {
  const isCurrentUser = ownerId === currentUserId
  const verb = isShared ? 'Shared' : 'Owned'

  if (isCurrentUser) {
    return <span className="text-xs text-[var(--color-ink-muted)]">{verb} by you</span>
  }

  if (!owner) return null

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
      <MemberAvatar displayName={owner.display_name} email={owner.email} size="sm" />
      {verb} by {owner.display_name || owner.email}
    </span>
  )
}
