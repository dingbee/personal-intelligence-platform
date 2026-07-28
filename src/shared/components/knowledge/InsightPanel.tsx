import type { ReactNode } from 'react'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Generic panel chrome for a knowledge-intelligence surface — title,
 * optional description/actions, loading/empty handling. Distinct from
 * modules/knowledge/components/DashboardSection (which is scoped to the
 * five Phase 6B dashboard sections and lives in that module); this one is
 * shared because Phase 7B uses it on the Dashboard, Document Detail, and
 * the Explorer page.
 */
export function InsightPanel({
  title,
  description,
  actions,
  isLoading,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  isLoading: boolean
  isEmpty: boolean
  emptyMessage: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-ink)]">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
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
