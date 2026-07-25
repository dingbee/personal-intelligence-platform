import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'

export function NotesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Notes</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Rich notes that stay searchable alongside your documents.
        </p>
      </div>
      <EmptyState
        title="No notes yet"
        description="Note creation arrives in a later milestone. This is a placeholder for your notes workspace."
        action={
          <Button disabled title="Coming in a future milestone">
            New note
          </Button>
        }
      />
    </div>
  )
}
