import { useState } from 'react'
import type { CollectionItemType } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { useKnowledgeCollections } from '@/modules/knowledge-intelligence/hooks/useKnowledgeCollections'
import { useBulkAddToCollection } from '@/modules/actions/hooks/useBulkAddToCollection'
import { Button } from '@/shared/components/ui/Button'

/**
 * UX-15.4 Phase 4 — the multi-select counterpart to `AddToCollectionButton`
 * (which only ever handles one item). A plain `<select>` + button rather
 * than that component's own popover-with-inline-create, since bulk mode
 * only needs "pick an existing collection," not authoring a new one
 * inline.
 */
export function BulkAddToCollectionControl({
  itemType,
  itemIds,
  onDone,
}: {
  itemType: CollectionItemType
  itemIds: string[]
  onDone?: () => void
}) {
  const { data: collections = [] } = useKnowledgeCollections()
  const [collectionId, setCollectionId] = useState('')
  const bulkAdd = useBulkAddToCollection(itemType)

  if (collections.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={collectionId}
        onChange={(e) => setCollectionId(e.target.value)}
        aria-label="Collection"
        className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2 py-1 text-xs text-[var(--color-ink)] shadow-inset outline-none"
      >
        <option value="">Add to collection…</option>
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        disabled={!collectionId || itemIds.length === 0}
        loading={bulkAdd.isPending}
        onClick={() =>
          bulkAdd.mutate(
            { collectionId, itemIds },
            {
              onSuccess: () => {
                setCollectionId('')
                onDone?.()
              },
            },
          )
        }
      >
        Add
      </Button>
    </div>
  )
}
