import { useState } from 'react'
import { useNoteTags } from '@/modules/notes/hooks/useNoteTags'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

/** UX-13.7.2 — the note-tags equivalent of DocumentTagEditor, same tag pool (note_tags joins into the same `tags` table document_tags does). */
export function NoteTagEditor({ noteId }: { noteId: string }) {
  const { tags, addTag, removeTag } = useNoteTags(noteId)
  const [addingTag, setAddingTag] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]"
        >
          {tag.name}
          <button
            type="button"
            aria-label={`Remove tag ${tag.name}`}
            onClick={() => removeTag.mutate(tag.id)}
            className="hover:text-[var(--color-ink)]"
          >
            ×
          </button>
        </span>
      ))}
      {addingTag ? (
        <InlineTextForm
          placeholder="Tag name"
          onSubmit={(name) => {
            addTag.mutate(name)
            setAddingTag(false)
          }}
          onCancel={() => setAddingTag(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddingTag(true)}
          className="rounded-full border border-dashed border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          + Tag
        </button>
      )}
    </div>
  )
}
