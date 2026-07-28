import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '@/shared/components/ui/Spinner'

/** Shared card chrome for every dashboard section — title, an optional "view all" link, and loading/empty handling. */
export function DashboardSection({
  title,
  viewAllHref,
  isLoading,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string
  viewAllHref?: string
  isLoading: boolean
  isEmpty: boolean
  emptyMessage: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">{title}</h2>
        {viewAllHref && (
          <Link to={viewAllHref} className="text-xs text-[var(--color-accent)] hover:underline">
            View all →
          </Link>
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : isEmpty ? (
        <p className="text-sm text-[var(--color-ink-muted)]">{emptyMessage}</p>
      ) : (
        children
      )}
    </section>
  )
}
