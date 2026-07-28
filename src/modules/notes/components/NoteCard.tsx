import { Link } from 'react-router-dom'
import type { NoteWithDocument } from '@/modules/notes/api/notes'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'

function previewText(content: string): string {
  const trimmed = content.trim()
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function NoteCard({ note, onDelete }: { note: NoteWithDocument; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/notes/${note.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]">
            {note.title}
          </h3>
        </Link>
        <DropdownMenu trigger={<span aria-hidden>⋯</span>}>
          <Link
            to={`/notes/${note.id}`}
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
          >
            Edit
          </Link>
          <DropdownMenuItem danger onClick={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      {note.content && <p className="text-sm text-[var(--color-ink-muted)]">{previewText(note.content)}</p>}

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-muted)]">
        {note.document && (
          <Link to={`/library/${note.document_id}`} className="hover:text-[var(--color-accent)]">
            📄 {note.document.title}
          </Link>
        )}
        <span>Created {formatDate(note.created_at)}</span>
        {note.updated_at !== note.created_at && <span>Updated {formatDate(note.updated_at)}</span>}
      </div>
    </div>
  )
}
