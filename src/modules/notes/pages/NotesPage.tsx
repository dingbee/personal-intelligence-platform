import { useNavigate } from 'react-router-dom'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { useMergeNotes } from '@/modules/notes/hooks/useMergeNotes'
import { NoteCard } from '@/modules/notes/components/NoteCard'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { useState } from 'react'

export function NotesPage() {
  const navigate = useNavigate()
  const { data: notes = [], isLoading, isError, error, create, remove } = useNotes()
  const mergeNotes = useMergeNotes()
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingMerge, setConfirmingMerge] = useState(false)

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedNotes = notes.filter((note) => selectedIds.has(note.id))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Notes</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Rich notes that stay searchable alongside your documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <span className="text-sm text-[var(--color-ink-muted)]">{selectedIds.size} selected</span>
              <Button variant="secondary" onClick={exitSelectionMode}>
                Cancel
              </Button>
              <Button disabled={selectedIds.size < 2} onClick={() => setConfirmingMerge(true)}>
                Merge
              </Button>
            </>
          ) : (
            <>
              {notes.length > 1 && (
                <Button variant="secondary" onClick={() => setSelectionMode(true)}>
                  Merge notes
                </Button>
              )}
              <Button
                loading={create.isPending}
                onClick={() => create.mutate({ title: 'Untitled note' }, { onSuccess: (note) => navigate(`/notes/${note.id}`) })}
              >
                New note
              </Button>
            </>
          )}
        </div>
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
            <NoteCard
              key={note.id}
              note={note}
              onDelete={() => setConfirmingDeleteId(note.id)}
              selectable={selectionMode}
              selected={selectedIds.has(note.id)}
              onToggleSelect={() => toggleSelected(note.id)}
            />
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

      <ConfirmDialog
        open={confirmingMerge}
        title={`Merge ${selectedIds.size} notes into one?`}
        description="The selected notes' content and tags will be combined into a new note, and the originals will be deleted. This can't be undone."
        confirmLabel="Merge"
        onConfirm={() => {
          setConfirmingMerge(false)
          mergeNotes.mutate(selectedNotes, {
            onSuccess: (merged) => {
              exitSelectionMode()
              navigate(`/notes/${merged.id}`)
            },
          })
        }}
        onCancel={() => setConfirmingMerge(false)}
      />
    </div>
  )
}
