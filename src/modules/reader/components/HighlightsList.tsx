import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHighlights } from '@/modules/reader/hooks/useHighlights'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { linkNoteToHighlight } from '@/modules/notes/api/knowledgeLinks'

export function HighlightsList({
  documentId,
  chapterIndex,
  chunkIds,
}: {
  documentId: string
  chapterIndex: number
  /** document_chunks that make up this chapter — recorded as the new note's source_chunk_ids so it stays traceable to what it was created from. */
  chunkIds: string[]
}) {
  const { highlights, setNote, remove } = useHighlights(documentId, chapterIndex)
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const { create: createNote } = useNotes()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creatingNoteId, setCreatingNoteId] = useState<string | null>(null)
  const [createdNoteIds, setCreatedNoteIds] = useState<Record<string, string>>({})

  async function createNoteFromHighlight(highlightId: string, quote: string) {
    setCreatingNoteId(highlightId)
    try {
      const note = await createNote.mutateAsync({
        title: quote.length > 60 ? `${quote.slice(0, 60)}…` : quote,
        content: quote,
        documentId,
        sourceChunkIds: chunkIds,
      })
      await linkNoteToHighlight({
        userId: user!.id,
        workspaceId: currentWorkspaceId,
        noteId: note.id,
        highlightId,
      })
      setCreatedNoteIds((prev) => ({ ...prev, [highlightId]: note.id }))
    } finally {
      setCreatingNoteId(null)
    }
  }

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

          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => remove.mutate(highlight.id)}
              className="text-xs text-[var(--color-ink-muted)] hover:text-red-600"
            >
              Remove highlight
            </button>
            {createdNoteIds[highlight.id] ? (
              <Link
                to={`/notes/${createdNoteIds[highlight.id]}`}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                View note →
              </Link>
            ) : (
              <button
                type="button"
                disabled={creatingNoteId === highlight.id}
                onClick={() => void createNoteFromHighlight(highlight.id, highlight.quote)}
                className="text-xs text-[var(--color-accent)] hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                {creatingNoteId === highlight.id ? 'Creating note…' : 'Create note'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
