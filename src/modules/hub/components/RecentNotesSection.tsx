import { Link } from 'react-router-dom'
import type { NoteWithDocument } from '@/modules/notes/api/notes'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/** UX-13.7.3 — most-recently-updated notes in this workspace, same compact list styling as the Hub's other sections (EvolutionTimelineSection, WorkspaceGapsSection). */
export function RecentNotesSection({ notes }: { notes: NoteWithDocument[] }) {
  if (notes.length === 0) {
    return <EmptyState title="No notes yet" description="Notes you write or save from a conversation will show up here." />
  }

  return (
    <ul className="flex flex-col gap-2">
      {notes.map((note) => (
        <li key={note.id} className="flex items-baseline justify-between gap-4 text-sm">
          <Link to={`/notes/${note.id}`} className="min-w-0 truncate text-[var(--color-ink)] hover:text-[var(--color-accent)]">
            {note.title || 'Untitled note'}
          </Link>
          <span className="shrink-0 text-xs text-[var(--color-ink-muted)]">{formatRelativeTime(note.updated_at)}</span>
        </li>
      ))}
    </ul>
  )
}
