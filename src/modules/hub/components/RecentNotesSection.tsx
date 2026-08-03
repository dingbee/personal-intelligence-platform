import type { NoteWithDocument } from '@/modules/notes/api/notes'
import { RecentActivityList } from '@/modules/hub/components/RecentActivityList'

/** UX-13.7.3 — most-recently-updated notes in this workspace. UX-15.2: rendering delegated to the shared RecentActivityList (see its own doc-comment for why). */
export function RecentNotesSection({ notes }: { notes: NoteWithDocument[] }) {
  return (
    <RecentActivityList
      items={notes.map((note) => ({
        key: note.id,
        href: `/notes/${note.id}`,
        title: note.title || 'Untitled note',
        updatedAt: note.updated_at,
      }))}
      emptyTitle="No notes yet"
      emptyDescription="Notes you write or save from a conversation will show up here."
    />
  )
}
