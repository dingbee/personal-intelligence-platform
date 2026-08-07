import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Spinner } from '@/shared/components/ui/Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-canvas)] shadow-raised hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent)]/60 disabled:shadow-none',
  secondary:
    'bg-[var(--surface-raised)] text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--surface-base)]',
  ghost: 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading = false, disabled, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        // Tactile press feedback for primary actions — a small, restrained
        // scale-down on :active, not a bounce or gaming-style effect.
        className={`inline-flex items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
