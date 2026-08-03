import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useKnowledgeCollection } from '@/modules/knowledge-intelligence/hooks/useKnowledgeCollection'
import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { CollectionItemType } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspaceRole } from '@/modules/workspaces/hooks/useWorkspaceRole'
import { useWorkspaceMemberDirectory } from '@/modules/workspaces/hooks/useWorkspaceMemberDirectory'
import { buildKnowledgeCollectionExportPackage } from '@/modules/knowledge-exchange/knowledge-collections/buildKnowledgeCollectionExportPackage'
import { buildCollectionExportContent } from '@/modules/export/content/collectionExportContent'
import { KnowledgeExportDialog } from '@/modules/export/components/KnowledgeExportDialog'
import { exportFilename } from '@/modules/export/types'
import { SourceReference } from '@/shared/components/knowledge/SourceReference'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { SharingBadge } from '@/shared/components/collaboration/SharingBadge'
import { OwnershipLine } from '@/shared/components/collaboration/OwnershipLine'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'

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
  const { collection, isLoading, isError, items, itemsLoading, itemsError, refetchItems, remove, removeItem } =
    useKnowledgeCollection(collectionId!)
  const { user } = useAuth()
  const { data: role } = useWorkspaceRole(collection?.workspace_id ?? null)
  const { isShared, lookup } = useWorkspaceMemberDirectory(collection?.workspace_id ?? null)
  const { createConversationWithQuery } = useCommandActions()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

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

  // UX-14.5 Phase 5 — mirrors the four-command RLS split
  // (0031_shared_knowledge_objects.sql): the collection's own creator
  // always keeps full rights, an editor can add/remove items but not
  // delete the collection itself, an owner gets everything.
  const isCollectionOwner = collection.user_id === user?.id
  const canEdit = isCollectionOwner || role === 'editor' || role === 'owner'
  const canDelete = isCollectionOwner || role === 'owner'

  return (
    <div className="flex flex-col gap-6">
      <Link to="/knowledge/collections" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Back to Collections
      </Link>

      <SectionHeader
        level="page"
        title={
          <span className="inline-flex items-center gap-2">
            {collection.name}
            {isShared && <SharingBadge isShared />}
          </span>
        }
        description={collection.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            {/* UX-14.5.11 — replaces the previous NOVA-package-only "Export
                collection" button with the unified Save As / Download
                experience: NOVA Package (this collection's existing,
                unmodified `buildKnowledgeCollectionExportPackage`), PDF,
                Markdown, or Word. */}
            <Button variant="secondary" onClick={() => setExportDialogOpen(true)}>
              Save As…
            </Button>
            {/* UX-15.1 — converges "Ask AI" onto the one mechanism/label
                every other object type's own entry point uses
                (`createConversationWithQuery`, same as Assets/Notes/
                Knowledge Nodes). */}
            <Button
              variant="secondary"
              onClick={() => void createConversationWithQuery(`I'd like to talk about a collection called "${collection.name}".`)}
            >
              Ask NOVA about this collection
            </Button>
            {canDelete && (
              <Button variant="secondary" onClick={() => setConfirmingDelete(true)}>
                Delete collection
              </Button>
            )}
          </div>
        }
      />

      {isShared && (
        <OwnershipLine
          ownerId={collection.user_id}
          currentUserId={user?.id}
          owner={lookup(collection.user_id)}
          isShared={isShared}
        />
      )}

      {itemsLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : itemsError ? (
        <EmptyState
          title="Couldn't load this collection's items"
          description="Something went wrong fetching what's in this collection — your items are still there, this is just a failed request."
          action={
            <Button variant="secondary" onClick={() => void refetchItems()}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
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
              onRemove={
                canEdit
                  ? (item) => removeItem.mutate({ itemType: item.type as CollectionItemType, itemId: item.id })
                  : undefined
              }
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

      <KnowledgeExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        objectLabel="collection"
        request={{
          content: buildCollectionExportContent(collection, items),
          titleForFilename: collection.name,
          buildNovaPackage: async () => {
            const { manifest, zipBlob } = await buildKnowledgeCollectionExportPackage(collectionId!)
            return { filename: exportFilename(manifest.collection.name, 'nova'), blob: zipBlob }
          },
        }}
      />
    </div>
  )
}
