import type { HTMLAttributes } from 'react'

/**
 * For content that floats above the page — dropdown panels, popovers,
 * standalone summary cards that should read as "above" rather than
 * "within" the page flow. Stronger elevation than SurfaceCard; still one
 * restrained shadow stack, not a decorative multi-shadow emboss.
 */
export function FloatingCard({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] shadow-floating ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
