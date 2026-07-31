import { useState } from 'react'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

export interface ConversationTitleEditorProps {
  title: string
  onRename: (title: string) => void
}

/**
 * UX-13.5A Phase 3 — click-to-edit conversation title. Reuses
 * InlineTextForm entirely (the same rename affordance already used for
 * notes/documents) rather than a bespoke input: Enter/blur commits,
 * Escape discards, empty values are rejected — all handled there.
 * Accessible as a real <button> in display mode so it's keyboard-reachable
 * and has a clear accessible name distinct from its visible text.
 */
export function ConversationTitleEditor({ title, onRename }: ConversationTitleEditorProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <InlineTextForm
        initialValue={title}
        placeholder="Conversation title"
        onSubmit={(value) => {
          setEditing(false)
          if (value !== title) onRename(value)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Rename conversation: ${title}`}
      className="min-w-0 max-w-full truncate text-left text-sm font-medium text-[var(--color-ink)] hover:underline"
    >
      {title}
    </button>
  )
}
