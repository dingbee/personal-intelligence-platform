import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useNote } from '@/modules/notes/hooks/useNote'
import { useNoteMutations } from '@/modules/notes/hooks/useNoteMutations'
import { useImproveWriting } from '@/modules/notes/hooks/useImproveWriting'
import { useCollections } from '@/modules/library/hooks/useCollections'
import { NoteEditor } from '@/modules/notes/components/NoteEditor'
import { NoteTagsEditor } from '@/modules/notes/components/NoteTagsEditor'
import { KnowledgeLinksPanel } from '@/modules/knowledgeLinks/components/KnowledgeLinksPanel'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const AUTOSAVE_DELAY_MS = 600

export function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const { note, isLoading, isError, save, addTag, removeTag } = useNote(noteId!)
  const { data: collections = [] } = useCollections()
  const { remove } = useNoteMutations()
  const improveWriting = useImproveWriting()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hasLoadedOnce = useRef(false)

  // Sync local editable state from the fetched note once, not on every
  // refetch — otherwise a background invalidation while typing would
  // clobber unsaved keystrokes.
  useEffect(() => {
    if (note && !hasLoadedOnce.current) {
      setTitle(note.title)
      setContent(note.content)
      hasLoadedOnce.current = true
    }
  }, [note])

  function scheduleSave(next: { title?: string; content?: string }) {
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => save.mutate(next), AUTOSAVE_DELAY_MS)
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    scheduleSave({ title: value })
  }

  function handleContentChange(html: string) {
    setContent(html)
    scheduleSave({ content: html })
  }

  async function handleImproveWriting() {
    const revised = await improveWriting.mutateAsync(content)
    clearTimeout(saveTimeout.current)
    setContent(revised)
    save.mutate({ content: revised })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !note) {
    return <EmptyState title="Couldn't load this note" description="It may have been deleted." />
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link to="/notes" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Notes
        </Link>
        <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
          Delete
        </Button>
      </div>

      <input
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Untitled note"
        className="w-full border-none bg-transparent text-3xl font-semibold text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
      />

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          Collection
          <select
            value={note.collection_id ?? ''}
            onChange={(e) => save.mutate({ collection_id: e.target.value || null })}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-ink)]"
          >
            <option value="">None</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>
        <NoteTagsEditor
          note={note}
          onAdd={(tagName) => addTag.mutate(tagName)}
          onRemove={(tagId) => removeTag.mutate(tagId)}
        />
        <Button
          variant="ghost"
          onClick={() => void handleImproveWriting()}
          loading={improveWriting.isPending}
          disabled={!content.trim()}
        >
          ✨ Improve writing
        </Button>
      </div>

      {improveWriting.isError && (
        <p className="text-sm text-red-600">
          Couldn't improve writing:{' '}
          {improveWriting.error instanceof Error ? improveWriting.error.message : 'Unknown error'}
        </p>
      )}

      <NoteEditor content={content} onChange={handleContentChange} />

      <KnowledgeLinksPanel sourceType="note" sourceId={note.id} />

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${note.title}"?`}
        description="This permanently removes the note. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(note.id)
          void navigate('/notes')
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
