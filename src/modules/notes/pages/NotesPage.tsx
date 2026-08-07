import { useNavigate } from 'react-router-dom'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { useMergeNotes } from '@/modules/notes/hooks/useMergeNotes'
import { NoteCard } from '@/modules/notes/components/NoteCard'
import { ImportNotePackageDialog } from '@/modules/knowledge-exchange/components/ImportNotePackageDialog'
import { useMultiSelect } from '@/shared/hooks/useMultiSelect'
import { BulkAddToCollectionControl } from '@/modules/actions/components/BulkAddToCollectionControl'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { useState } from 'react'

export function NotesPage() {
  const navigate = useNavigate()
  const { data: notes = [], isLoading, isError, error, create, remove } = useNotes()
  const mergeNotes = useMergeNotes()
  const { createConversationWithQuery } = useCommandActions()
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const multiSelect = useMultiSelect()
  const [confirmingMerge, setConfirmingMerge] = useState(false)
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const selectedNotes = notes.filter((note) => multiSelect.selectedIds.has(note.id))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Notes</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Rich notes that stay searchable alongside your documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {multiSelect.active ? (
            <>
              <span className="text-sm text-[var(--color-ink-muted)]">{multiSelect.selectedIds.size} selected</span>
              <Button variant="secondary" onClick={multiSelect.disable}>
                Cancel
              </Button>
              {/* UX-15.4 Phase 4 — multi-select actions, all reusing existing single-item APIs in a loop, no batch endpoints. */}
              <BulkAddToCollectionControl itemType="note" itemIds={[...multiSelect.selectedIds]} onDone={multiSelect.disable} />
              <Button
                variant="secondary"
                disabled={selectedNotes.length === 0}
                onClick={() =>
                  void createConversationWithQuery(
                    `I'd like to discuss these notes: ${selectedNotes.map((n) => `"${n.title || 'Untitled note'}"`).join(', ')}.`,
                  )
                }
              >
                Ask NOVA
              </Button>
              <Button
                variant="secondary"
                loading={mergeNotes.isPending}
                disabled={multiSelect.selectedIds.size < 2}
                onClick={() => setConfirmingMerge(true)}
              >
                Merge
              </Button>
              <Button
                variant="secondary"
                loading={bulkDeleting}
                disabled={multiSelect.selectedIds.size === 0}
                onClick={() => setConfirmingBulkDelete(true)}
              >
                Delete
              </Button>
            </>
          ) : (
            <>
              {notes.length > 1 && (
                <Button variant="secondary" onClick={multiSelect.enable}>
                  Select
                </Button>
              )}
              <Button variant="secondary" onClick={() => setImportDialogOpen(true)}>
                Import
              </Button>
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

      {mergeNotes.isError && (
        <p className="text-sm text-[var(--color-danger)]">
          Couldn't merge those notes: {mergeNotes.error instanceof Error ? mergeNotes.error.message : 'Unknown error'}.
          The merge runs in several steps — check your notes list before retrying, in case it partially completed
          (e.g. a merged note was created but the originals weren't deleted yet).
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-[var(--color-danger)]">
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
              selectable={multiSelect.active}
              selected={multiSelect.selectedIds.has(note.id)}
              onToggleSelect={() => multiSelect.toggle(note.id)}
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
        title={`Merge ${multiSelect.selectedIds.size} notes into one?`}
        description="The selected notes' content and tags will be combined into a new note, and the originals will be deleted. This can't be undone."
        confirmLabel="Merge"
        onConfirm={() => {
          setConfirmingMerge(false)
          mergeNotes.mutate(selectedNotes, {
            onSuccess: (merged) => {
              multiSelect.disable()
              navigate(`/notes/${merged.id}`)
            },
          })
        }}
        onCancel={() => setConfirmingMerge(false)}
      />

      <ConfirmDialog
        open={confirmingBulkDelete}
        title={`Delete ${multiSelect.selectedIds.size} notes?`}
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          setConfirmingBulkDelete(false)
          setBulkDeleting(true)
          await Promise.all([...multiSelect.selectedIds].map((id) => remove.mutateAsync(id)))
          setBulkDeleting(false)
          multiSelect.disable()
        }}
        onCancel={() => setConfirmingBulkDelete(false)}
      />

      <ImportNotePackageDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} />
    </div>
  )
}
