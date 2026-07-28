import type { ReactNode } from 'react'

/**
 * Title (+ optional description + trailing action) row — the pattern
 * every page header and settings card already repeats by hand
 * (`<h1>/<h2> ... <Link>...</Link>`). New/upgraded surfaces should reach
 * for this instead of re-hand-rolling the flex row each time.
 */
export function SectionHeader({
  title,
  description,
  action,
  level = 'section',
}: {
  title: string
  description?: string
  action?: ReactNode
  /** 'page' renders an <h1> at page-title scale; 'section' renders an <h2> at section-title scale. */
  level?: 'page' | 'section'
}) {
  const Heading = level === 'page' ? 'h1' : 'h2'
  const titleClass = level === 'page' ? 'text-2xl font-semibold' : 'text-sm font-medium'

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Heading className={`${titleClass} text-[var(--color-ink)]`}>{title}</Heading>
        {description && <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
