import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useKnowledgeCollections } from '@/modules/knowledge-intelligence/hooks/useKnowledgeCollections'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/**
 * UX-13 roadmap Phase 4 — Knowledge Collections: curated groupings that can
 * span documents, notes, conversations, images, and concepts, unlike the
 * existing single-type document Collections (folders). Membership itself
 * lives in knowledge_links (see api/knowledgeCollections.ts); this page
 * only lists/creates the collections themselves.
 */
export function KnowledgeCollectionsPage() {
  const navigate = useNavigate()
  const { data: collections = [], isLoading, isError, create } = useKnowledgeCollections()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  return (
    <div className="flex flex-col gap-6">
      <Link to="/knowledge" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Back to Knowledge
      </Link>

      <SectionHeader
        level="page"
        title="Knowledge Collections"
        description="Curated sets of documents, notes, conversations, images, and concepts — more powerful than folders because they can span every type."
        action={<Button onClick={() => setCreating(true)}>New collection</Button>}
      />

      {creating && (
        <form
          className="flex items-center gap-2 rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-3 shadow-raised"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return
            create.mutate(
              { name: name.trim() },
              {
                onSuccess: (collection) => {
                  setCreating(false)
                  setName('')
                  navigate(`/knowledge/collections/${collection.id}`)
                },
              },
            )
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Collection name"
            className="min-w-0 flex-1 rounded-control border border-[var(--color-border)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--color-ink)]"
          />
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            Create
          </Button>
          <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-[var(--color-danger)]">Couldn't load your collections.</p>
      ) : collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          description="Create one, then add documents, notes, conversations, images, or concepts to it from their own pages."
          action={<Button onClick={() => setCreating(true)}>New collection</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              to={`/knowledge/collections/${collection.id}`}
              className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
            >
              <h3 className="font-medium text-[var(--color-ink)]">{collection.name}</h3>
              {collection.description && (
                <p className="line-clamp-2 text-sm text-[var(--color-ink-muted)]">{collection.description}</p>
              )}
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Updated {formatRelativeTime(collection.updated_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
