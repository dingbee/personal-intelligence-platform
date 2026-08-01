import { Link } from 'react-router-dom'
import type { NoteWithDocument } from '@/modules/notes/api/notes'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { ArtifactKindBadge } from '@/modules/notes/components/ArtifactKindBadge'
import { getArtifactKind } from '@/modules/ai/artifacts/artifactMetadata'

function previewText(content: string): string {
  const trimmed = content.trim()
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function NoteCard({
  note,
  onDelete,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  note: NoteWithDocument
  onDelete: () => void
  /** Knowledge Actions v1 — Merge Notes selection mode. */
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${note.title} for merge`}
            className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
          />
        )}
        <Link to={`/notes/${note.id}`} className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]">
              {note.title}
            </h3>
            <span className="shrink-0">
              <ArtifactKindBadge kind={getArtifactKind(note)} />
            </span>
          </div>
        </Link>
        {!selectable && (
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
        )}
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
