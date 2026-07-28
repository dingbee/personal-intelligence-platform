import type { Collection } from '@/shared/types/database'
import { useDocumentMutations } from '@/modules/library/hooks/useDocumentMutations'

export function CollectionMoveSelect({
  documentId,
  collectionId,
  collections,
  onSuccess,
}: {
  documentId: string
  collectionId: string | null
  collections: Collection[]
  /** Called after a successful move, in addition to the hook's own cache invalidation — for callers (e.g. the document detail page) that cache this document under a separate query key. */
  onSuccess?: () => void
}) {
  const { move } = useDocumentMutations()

  return (
    <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
      Collection
      <select
        value={collectionId ?? ''}
        onChange={(e) =>
          move.mutate(
            { id: documentId, collectionId: e.target.value || null },
            onSuccess ? { onSuccess } : undefined,
          )
        }
        className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-ink)]"
      >
        <option value="">None</option>
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </select>
    </label>
  )
}
