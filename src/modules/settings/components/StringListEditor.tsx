import { useState } from 'react'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

export function StringListEditor({
  label,
  values,
  onChange,
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="hover:text-[var(--color-ink)]"
            >
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <InlineTextForm
            placeholder="Add..."
            onSubmit={(value) => {
              onChange([...values, value])
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  )
}
