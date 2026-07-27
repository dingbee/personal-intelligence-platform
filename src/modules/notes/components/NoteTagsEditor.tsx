import { useState } from 'react'
import type { NoteWithTags } from '@/modules/notes/api/notes'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

export function NoteTagsEditor({
  note,
  onAdd,
  onRemove,
}: {
  note: NoteWithTags
  onAdd: (tagName: string) => void
  onRemove: (tagId: string) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {note.tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]"
        >
          {tag.name}
          <button
            type="button"
            aria-label={`Remove tag ${tag.name}`}
            onClick={() => onRemove(tag.id)}
            className="hover:text-[var(--color-ink)]"
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <InlineTextForm
          placeholder="Tag name"
          onSubmit={(name) => {
            onAdd(name)
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
          + Tag
        </button>
      )}
    </div>
  )
}
