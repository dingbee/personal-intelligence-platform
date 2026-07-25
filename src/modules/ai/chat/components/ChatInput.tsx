import { useState, type KeyboardEvent } from 'react'
import { Button } from '@/shared/components/ui/Button'

export function ChatInput({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [value, setValue] = useState('')

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-[var(--color-border)] p-4">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your library..."
        rows={1}
        disabled={disabled}
        className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)]"
      />
      <Button onClick={submit} disabled={disabled || !value.trim()}>
        Send
      </Button>
    </div>
  )
}
