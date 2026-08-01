import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useKnowledgeCollection } from '@/modules/knowledge-intelligence/hooks/useKnowledgeCollection'
import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { CollectionItemType } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { SourceReference } from '@/shared/components/knowledge/SourceReference'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

const TYPE_LABEL: Record<string, string> = {
  document: 'Documents',
  note: 'Notes',
  conversation: 'Conversations',
  asset: 'Images',
  knowledge_node: 'Concepts',
}

export function KnowledgeCollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const navigate = useNavigate()
  const { collection, isLoading, isError, items, remove, removeItem } = useKnowledgeCollection(collectionId!)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (isError || !collection) {
    return (
      <EmptyState
        title="Collection not found"
        description="It may have been deleted."
        action={
          <Link to="/knowledge/collections">
            <Button variant="secondary">Back to Collections</Button>
          </Link>
        }
      />
    )
  }

  const itemsByType = new Map<string, EvidenceItem[]>()
  for (const item of items) {
    const list = itemsByType.get(item.type) ?? []
    list.push(item)
    itemsByType.set(item.type, list)
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/knowledge/collections" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Back to Collections
      </Link>

      <SectionHeader
        level="page"
        title={collection.name}
        description={collection.description ?? undefined}
        action={
          <Button variant="secondary" onClick={() => setConfirmingDelete(true)}>
            Delete collection
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing in this collection yet"
          description="Add documents, notes, conversations, images, or concepts to it from their own pages."
        />
      ) : (
        Array.from(itemsByType.entries()).map(([type, list]) => (
          <div key={type} className="flex flex-col gap-3">
            <SectionHeader title={TYPE_LABEL[type] ?? type} />
            <SourceReference
              sources={list}
              label=""
              onRemove={(item) => removeItem.mutate({ itemType: item.type as CollectionItemType, itemId: item.id })}
            />
          </div>
        ))
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this collection?"
        description="The collection and its item links will be removed. The documents, notes, conversations, images, and concepts inside it are not affected."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmingDelete(false)
          remove.mutate(undefined, { onSuccess: () => navigate('/knowledge/collections') })
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
