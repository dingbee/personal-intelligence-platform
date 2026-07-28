import { useNavigate } from 'react-router-dom'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { NoteCard } from '@/modules/notes/components/NoteCard'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { useState } from 'react'

export function NotesPage() {
  const navigate = useNavigate()
  const { data: notes = [], isLoading, isError, error, create, remove } = useNotes()
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Notes</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Rich notes that stay searchable alongside your documents.
          </p>
        </div>
        <Button
          loading={create.isPending}
          onClick={() => create.mutate({ title: 'Untitled note' }, { onSuccess: (note) => navigate(`/notes/${note.id}`) })}
        >
          New note
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">
          Couldn't load your notes: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      ) : notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Create a standalone note, or start one from a highlight while reading."
          action={<Button onClick={() => create.mutate({ title: 'Untitled note' }, { onSuccess: (note) => navigate(`/notes/${note.id}`) })}>New note</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={() => setConfirmingDeleteId(note.id)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmingDeleteId !== null}
        title="Delete this note?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmingDeleteId) remove.mutate(confirmingDeleteId)
          setConfirmingDeleteId(null)
        }}
        onCancel={() => setConfirmingDeleteId(null)}
      />
    </div>
  )
}
