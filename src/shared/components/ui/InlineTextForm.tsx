import { useRef, useState, type FormEvent } from 'react'

interface InlineTextFormProps {
  initialValue?: string
  placeholder?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function InlineTextForm({ initialValue = '', placeholder, onSubmit, onCancel }: InlineTextFormProps) {
  const [value, setValue] = useState(initialValue)
  // Escape is the only explicit discard — losing focus any other way (click
  // away, tab away) now commits instead of silently discarding the edit.
  // This flag stops the blur that follows an Escape keypress from re-running
  // commitOrCancel a second time.
  const discardedRef = useRef(false)

  function commitOrCancel() {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
    else onCancel()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    commitOrCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            discardedRef.current = true
            onCancel()
          }
        }}
        onBlur={() => {
          if (discardedRef.current) return
          commitOrCancel()
        }}
        className="w-full rounded-control border border-[var(--color-accent)] bg-[var(--surface-inset)] px-2 py-1 text-sm shadow-inset outline-none transition-shadow"
      />
    </form>
  )
}
