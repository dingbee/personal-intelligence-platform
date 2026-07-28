import { useNotes } from '@/modules/notes/hooks/useNotes'
import { NoteCard } from '@/modules/notes/components/NoteCard'
import { DashboardSection } from '@/modules/knowledge/components/DashboardSection'

export function RecentNotesSection() {
  const { data: notes = [], isLoading, remove } = useNotes({ limit: 5 })

  return (
    <DashboardSection
      title="Recent notes"
      viewAllHref="/notes"
      isLoading={isLoading}
      isEmpty={notes.length === 0}
      emptyMessage="No notes yet — create one from the Notes page or while reading."
    >
      <div className="flex flex-col gap-3">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} onDelete={() => remove.mutate(note.id)} />
        ))}
      </div>
    </DashboardSection>
  )
}
