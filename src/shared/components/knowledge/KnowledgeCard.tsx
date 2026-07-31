import type { ReactNode } from 'react'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

/** The primary visual unit for an AI-extracted concept or entity — reused by the Dashboard insights panel, the Document Detail extraction results, and the Knowledge Explorer, so its look changes in one place. */
export function KnowledgeCard({
  title,
  typeLabel,
  description,
  children,
}: {
  title: string
  typeLabel: string
  description?: string | null
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4 shadow-raised transition-shadow hover:shadow-floating">
      <div className="flex items-center gap-2">
        <span className="shrink-0">
          <StatusBadge label={typeLabel} variant="info" />
        </span>
        <h3 className="min-w-0 truncate text-sm font-medium text-[var(--color-ink)]" title={title}>
          {title}
        </h3>
      </div>
      {description && <p className="text-sm text-[var(--color-ink-muted)]">{description}</p>}
      {children}
    </div>
  )
}
