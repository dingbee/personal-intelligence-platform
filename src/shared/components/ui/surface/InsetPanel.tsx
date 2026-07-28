import type { HTMLAttributes } from 'react'

/**
 * The "embedded" counterpart to SurfaceCard/FloatingCard — recessed
 * rather than raised, for content that reads as part of the surface it
 * sits on (stat blocks, quoted/reference text, grouped metadata) rather
 * than a card floating above it.
 */
export function InsetPanel({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-control bg-[var(--surface-inset)] shadow-inset ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
