import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Input } from '@/shared/components/ui/Input'

export function SearchPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Search</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Semantic search across your entire knowledge base.
        </p>
      </div>
      <Input label="Search" placeholder="Search your knowledge base..." disabled />
      <EmptyState
        title="Semantic search isn't wired up yet"
        description="Embeddings and vector search arrive once documents can be ingested in a later milestone."
      />
    </div>
  )
}
