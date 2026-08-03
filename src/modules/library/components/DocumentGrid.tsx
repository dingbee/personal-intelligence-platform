import type { Collection } from '@/shared/types/database'
import type { DocumentWithTags } from '@/modules/library/api/documents'
import { DocumentCard } from '@/modules/library/components/DocumentCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'

export function DocumentGrid({
  documents,
  collections,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: {
  documents: DocumentWithTags[]
  collections: Collection[]
  /** UX-15.4 Phase 4 — multi-select mode, threaded down to each DocumentCard. */
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}) {
  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents here"
        description="Upload a file above, or pick a different collection or tag filter."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          collections={collections}
          selectable={selectable}
          selected={selectedIds?.has(document.id) ?? false}
          onToggleSelect={() => onToggleSelect?.(document.id)}
        />
      ))}
    </div>
  )
}
