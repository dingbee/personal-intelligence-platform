import { useState } from 'react'
import { useHighlights } from '@/modules/reader/hooks/useHighlights'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

export function HighlightsList({ documentId, chapterIndex }: { documentId: string; chapterIndex: number }) {
  const { highlights, setNote, remove } = useHighlights(documentId, chapterIndex)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (highlights.length === 0) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Select text in the chapter to highlight it.</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {highlights.map((highlight) => (
        <li key={highlight.id} className="rounded-lg border-l-2 border-[var(--color-accent)] bg-[var(--color-canvas)] p-3">
          <p className="text-sm italic text-[var(--color-ink)]">“{highlight.quote}”</p>

          {editingId === highlight.id ? (
            <div className="mt-2">
              <InlineTextForm
                initialValue={highlight.note ?? ''}
                placeholder="Add a note..."
                onSubmit={(note) => {
                  setNote.mutate({ id: highlight.id, note })
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : highlight.note ? (
            <button
              type="button"
              onClick={() => setEditingId(highlight.id)}
              className="mt-1 block text-left text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              {highlight.note}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditingId(highlight.id)}
              className="mt-1 text-xs text-[var(--color-accent)] hover:underline"
            >
              + Add note
            </button>
          )}

          <button
            type="button"
            onClick={() => remove.mutate(highlight.id)}
            className="mt-1 block text-xs text-[var(--color-ink-muted)] hover:text-red-600"
          >
            Remove highlight
          </button>
        </li>
      ))}
    </ul>
  )
}
