import type { ReactNode } from 'react'

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
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2">
        <span className="inline-block shrink-0 rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
          {typeLabel}
        </span>
        <h3 className="truncate text-sm font-medium text-[var(--color-ink)]">{title}</h3>
      </div>
      {description && <p className="text-sm text-[var(--color-ink-muted)]">{description}</p>}
      {children}
    </div>
  )
}
