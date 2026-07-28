import type { Collection } from '@/shared/types/database'
import { CollectionTree } from '@/modules/library/components/CollectionTree'
import { Spinner } from '@/shared/components/ui/Spinner'

export interface CollectionsPanelContentProps {
  collections: Collection[]
  collectionsLoading: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
}

/**
 * The Collections heading + tree/spinner — no chrome of its own, so it can
 * be reused by LibraryPage's persistent desktop aside and
 * MobileCollectionsDrawer without duplicating this markup. Same split as
 * Sidebar/SidebarNav.
 */
export function CollectionsPanelContent({ collections, collectionsLoading, selectedId, onSelect }: CollectionsPanelContentProps) {
  return (
    <>
      <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Collections</h2>
      {collectionsLoading ? (
        <Spinner size="sm" />
      ) : (
        <CollectionTree collections={collections} selectedId={selectedId} onSelect={onSelect} />
      )}
    </>
  )
}
