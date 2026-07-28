const VARIANT_CLASSES = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
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
