import { useState, type FormEvent } from 'react'

interface InlineTextFormProps {
  initialValue?: string
  placeholder?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function InlineTextForm({ initialValue = '', placeholder, onSubmit, onCancel }: InlineTextFormProps) {
  const [value, setValue] = useState(initialValue)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
    else onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={onCancel}
        className="w-full rounded-md border border-[var(--color-accent)] bg-[var(--color-surface)] px-2 py-1 text-sm outline-none"
      />
    </form>
  )
}
