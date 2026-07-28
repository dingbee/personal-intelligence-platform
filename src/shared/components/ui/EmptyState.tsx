import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-[var(--color-border)] bg-[var(--surface-inset)] px-6 py-16 text-center">
      {icon && <div className="text-[var(--color-ink-muted)]">{icon}</div>}
      <h2 className="text-lg font-medium text-[var(--color-ink)]">{title}</h2>
      {description && (
        <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">{description}</p>
      )}
      {action}
    </div>
  )
}
