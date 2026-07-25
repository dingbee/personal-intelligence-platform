import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'

export function LibraryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Library</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Your documents, books, and collections live here.
        </p>
      </div>
      <EmptyState
        title="Your library is empty"
        description="Document upload and processing arrive in a later milestone. This is a placeholder for the knowledge library."
        action={
          <Button disabled title="Coming in a future milestone">
            Upload a document
          </Button>
        }
      />
    </div>
  )
}
