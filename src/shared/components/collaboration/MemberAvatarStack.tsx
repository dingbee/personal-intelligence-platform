import { MemberAvatar } from '@/shared/components/collaboration/MemberAvatar'

export interface DirectoryMember {
  user_id: string
  display_name: string | null
  email: string
}

/**
 * UX-14.5 Phase 5 — deliverable #1: "workspace member avatars throughout
 * shared workspaces." A single overlapping row, capped at `max` with a
 * "+N" overflow marker rather than an unbounded list — this renders
 * inline in cards and headers, not as its own scrollable surface.
 * Renders nothing for a one-member (personal) workspace, so it never
 * shows a lone avatar of yourself.
 */
export function MemberAvatarStack({
  members,
  max = 4,
  size = 'sm',
}: {
  members: DirectoryMember[]
  max?: number
  size?: 'sm' | 'md'
}) {
  if (members.length <= 1) return null

  const visible = members.slice(0, max)
  const overflow = members.length - visible.length

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((member) => (
        <MemberAvatar
          key={member.user_id}
          displayName={member.display_name}
          email={member.email}
          size={size}
          className="ring-2 ring-[var(--color-surface)]"
        />
      ))}
      {overflow > 0 && (
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-inset)] font-medium text-[var(--color-ink-muted)] ring-2 ring-[var(--color-surface)] ${
            size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs'
          }`}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
