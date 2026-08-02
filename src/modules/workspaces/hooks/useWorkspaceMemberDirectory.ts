import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listWorkspaceMembers } from '@/modules/workspaces/api/workspaceMembers'
import type { DirectoryMember } from '@/shared/components/collaboration/MemberAvatarStack'

/**
 * UX-14.5 Phase 5 — the one directory every collaboration UI primitive
 * (MemberAvatarStack, OwnershipLine, SharingBadge's `isShared` input)
 * reads from. Wraps Phase 3's `list_workspace_members` RPC — no new
 * backend surface — and adds two things that RPC alone doesn't give a
 * UI consumer: an O(1) `lookup(userId)` for "who owns this note," and
 * `isShared`, computed from actual active-member count rather than
 * from `workspace_id` merely being non-null (a workspace with only its
 * owner in it isn't meaningfully shared yet). `workspaceId: null`
 * short-circuits with no network call — the common case today, since
 * most content is still personal.
 */
export function useWorkspaceMemberDirectory(workspaceId: string | null) {
  const query = useQuery({
    queryKey: ['workspace-member-directory', workspaceId],
    queryFn: () => listWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId),
  })

  const members = useMemo<DirectoryMember[]>(
    () =>
      (query.data ?? [])
        .filter((member) => member.status === 'active')
        .map((member) => ({ user_id: member.user_id, display_name: member.display_name, email: member.email })),
    [query.data],
  )

  const byUserId = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members])

  return {
    members,
    isShared: members.length > 1,
    isLoading: query.isLoading,
    lookup: (userId: string): DirectoryMember | null => byUserId.get(userId) ?? null,
  }
}
