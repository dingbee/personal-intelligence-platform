import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

export interface ActivityListItem {
  key: string
  href: string
  title: string
  updatedAt: string
  /** Rendered before the title — e.g. pinned/favorite icons (`ActiveConversationsSection`). */
  leading?: ReactNode
  /** Rendered after the title, before the relative time — e.g. an owner avatar (`CollaborationSection`). */
  trailing?: ReactNode
  /** AI Experience Intelligence v1 — present only for dismissible proactive-intelligence rows (Hub's IntelligenceZoneItems). Other consumers (RecentNotesSection, ActiveConversationsSection, CollaborationSection) omit it and render no dismiss control. */
  onDismiss?: () => void
}

/**
 * UX-15.2 — the one "list of {title, link, relative-time}" renderer,
 * replacing three independent implementations of the identical shape
 * that had accumulated across `RecentNotesSection`, `ActiveConversationsSection`,
 * and `CollaborationSection`'s own inline-built activity feed (see the
 * discovery's finding #2). Each of those three keeps its own data-shaping
 * (which fields become the title/href, which badges become `leading`/
 * `trailing`) — this component only owns the shared row markup and the
 * empty state.
 */
export function RecentActivityList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: ActivityListItem[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-baseline justify-between gap-4 text-sm">
          <Link to={item.href} className="flex min-w-0 items-center gap-1 truncate text-[var(--color-ink)] hover:text-[var(--color-accent)]">
            {item.leading}
            <span className="min-w-0 truncate">{item.title}</span>
          </Link>
          <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            {item.trailing}
            {formatRelativeTime(item.updatedAt)}
            {item.onDismiss && (
              <button
                type="button"
                onClick={item.onDismiss}
                aria-label="Dismiss"
                className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              >
                ✕
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
