import { Link } from 'react-router-dom'
import type { Collection } from '@/shared/types/database'
import type { NoteWithTags } from '@/modules/notes/api/notes'
import { useNoteMutations } from '@/modules/notes/hooks/useNoteMutations'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { useState } from 'react'

function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent ?? ''
}

export function NoteCard({ note, collections }: { note: NoteWithTags; collections: Collection[] }) {
  const { remove } = useNoteMutations()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const collectionName = collections.find((c) => c.id === note.collection_id)?.name

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/notes/${note.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-[var(--color-ink)]">{note.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
            {stripHtml(note.content) || 'No content yet'}
          </p>
        </Link>
        <DropdownMenu trigger={<span aria-hidden>⋯</span>}>
          <DropdownMenuItem danger onClick={() => setConfirmingDelete(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
        {collectionName && <span className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5">{collectionName}</span>}
        {note.tags.map((tag) => (
          <span key={tag.id} className="rounded-full bg-[var(--color-canvas)] px-2 py-0.5">
            {tag.name}
          </span>
        ))}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${note.title}"?`}
        description="This permanently removes the note. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(note.id)
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
