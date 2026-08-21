import { forwardRef, useState, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', type = 'text', ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
    const isPassword = type === 'password'
    const [visible, setVisible] = useState(false)
    const inputType = isPassword && visible ? 'text' : type

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-ink)]">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 pr-11 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)] ${className}`}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              onClick={() => setVisible((current) => !current)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <span aria-hidden="true">{visible ? '◉' : '◉'}</span>
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'
