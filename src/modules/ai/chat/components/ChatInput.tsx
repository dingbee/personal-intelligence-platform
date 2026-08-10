import { useState, type KeyboardEvent } from 'react'
import { Button } from '@/shared/components/ui/Button'

export function ChatInput({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => Promise<boolean> }) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled || submitting) return
    setSubmitting(true)
    // Only clear on a confirmed success — a failed send leaves the typed
    // text in place (still editable) instead of silently discarding it;
    // the caller's error/Retry affordance covers what happened.
    const succeeded = await onSend(trimmed)
    setSubmitting(false)
    if (succeeded) setValue('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    // PIP Stabilization v1 (P1 mobile) — pb-[max(1rem,env(safe-area-inset-bottom))]
    // keeps the composer clear of the home-indicator area on notched
    // iPhones (env() resolves once index.html's viewport-fit=cover is set;
    // it's simply 0 elsewhere, so this is a no-op on every other device).
    <div className="flex items-end gap-2 border-t border-[var(--color-border)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your library..."
        rows={1}
        disabled={disabled}
        className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)]"
      />
      <Button onClick={() => void submit()} disabled={disabled || submitting || !value.trim()}>
        Send
      </Button>
    </div>
  )
}
