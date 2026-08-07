const VARIANT_CLASSES = {
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success-strong)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-strong)]',
  error: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-strong)]',
  info: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  neutral: 'bg-[var(--color-ink-muted)]/10 text-[var(--color-ink-muted)]',
} as const

/** A small colored pill for status/state — the generic primitive behind ad hoc badge styling scattered across the app. */
export function StatusBadge({
  label,
  variant = 'neutral',
}: {
  label: string
  variant?: keyof typeof VARIANT_CLASSES
}) {
  return (
    <span className={`inline-flex rounded-pill px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
      {label}
    </span>
  )
}
