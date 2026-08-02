import { getInitials } from '@/shared/utils/getInitials'

const SIZE_CLASSES = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
} as const

/**
 * UX-14.5 Phase 5 — the one identity marker every collaboration surface
 * uses (member lists, avatar stacks, "owned/shared by" lines). No
 * profile photo support exists anywhere in this app, so initials-on-a-
 * colored-circle is the whole design, matching the restrained,
 * CSS-variable-driven style the rest of `shared/components/ui` uses
 * rather than inventing a separate visual language for collaboration.
 */
export function MemberAvatar({
  displayName,
  email,
  size = 'md',
  className = '',
}: {
  displayName: string | null
  email: string
  size?: keyof typeof SIZE_CLASSES
  className?: string
}) {
  return (
    <span
      title={displayName || email}
      aria-label={displayName || email}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 font-medium text-[var(--color-accent)] ${SIZE_CLASSES[size]} ${className}`}
    >
      {getInitials(displayName, email)}
    </span>
  )
}
