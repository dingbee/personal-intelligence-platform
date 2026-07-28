import type { HTMLAttributes } from 'react'

const PADDING_CLASSES = { sm: 'p-4', md: 'p-6', lg: 'p-8' } as const

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof PADDING_CLASSES
}

/**
 * The default elevated card (Phase UX-3.5) — replaces the repeated
 * `rounded-xl border ... bg-[var(--color-surface)] p-6` pattern with one
 * primitive. Existing cards migrate gradually; this is for new/upgraded
 * surfaces (Workspace Management, Knowledge Explorer/Dashboard), not a
 * mechanical find-and-replace across the whole app.
 */
export function SurfaceCard({ padding = 'md', className = '', children, ...props }: SurfaceCardProps) {
  return (
    <div
      className={`rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] shadow-raised transition-shadow ${PADDING_CLASSES[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
