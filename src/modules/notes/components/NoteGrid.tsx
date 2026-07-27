import type { Collection } from '@/shared/types/database'
import type { NoteWithTags } from '@/modules/notes/api/notes'
import { NoteCard } from '@/modules/notes/components/NoteCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'

export function NoteGrid({ notes, collections }: { notes: NoteWithTags[]; collections: Collection[] }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        title="No notes here"
        description="Create a note above, or pick a different collection or tag filter."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} collections={collections} />
      ))}
    </div>
  )
}
