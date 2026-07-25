import { useState } from 'react'
import type { Collection } from '@/shared/types/database'
import { buildCollectionTree, type CollectionNode } from '@/modules/library/utils/collectionTree'
import { useCollections } from '@/modules/library/hooks/useCollections'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

interface CollectionTreeProps {
  collections: Collection[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function CollectionTree({ collections, selectedId, onSelect }: CollectionTreeProps) {
  const { create } = useCollections()
  const [creatingRoot, setCreatingRoot] = useState(false)
  const tree = buildCollectionTree(collections)

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors ${
          selectedId === null
            ? 'bg-[var(--color-canvas)] text-[var(--color-ink)]'
            : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'
        }`}
      >
        All documents
      </button>

      {tree.map((node) => (
        <CollectionTreeItem key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} depth={0} />
      ))}

      {creatingRoot ? (
        <div className="px-3 py-1">
          <InlineTextForm
            placeholder="Collection name"
            onSubmit={(name) => {
              create.mutate({ name, parentId: null })
              setCreatingRoot(false)
            }}
            onCancel={() => setCreatingRoot(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreatingRoot(true)}
          className="mt-1 rounded-lg px-3 py-1.5 text-left text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
        >
          + New collection
        </button>
      )}
    </div>
  )
}

function CollectionTreeItem({
  node,
  selectedId,
  onSelect,
  depth,
}: {
  node: CollectionNode
  selectedId: string | null
  onSelect: (id: string | null) => void
  depth: number
}) {
  const { rename, remove, create } = useCollections()
  const [renaming, setRenaming] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div>
      {renaming ? (
        <div style={{ paddingLeft: depth * 16 }} className="px-3 py-1">
          <InlineTextForm
            initialValue={node.name}
            onSubmit={(name) => {
              rename.mutate({ id: node.id, name })
              setRenaming(false)
            }}
            onCancel={() => setRenaming(false)}
          />
        </div>
      ) : (
        <div
          style={{ paddingLeft: depth * 16 }}
          className={`group flex items-center justify-between rounded-lg pr-1 text-sm transition-colors ${
            selectedId === node.id
              ? 'bg-[var(--color-canvas)] text-[var(--color-ink)]'
              : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'
          }`}
        >
          <button type="button" onClick={() => onSelect(node.id)} className="flex-1 truncate px-3 py-1.5 text-left">
            {node.name}
          </button>
          <DropdownMenu
            trigger={
              <span aria-hidden className="opacity-0 group-hover:opacity-100">
                ⋯
              </span>
            }
          >
            <DropdownMenuItem onClick={() => setAddingChild(true)}>New subfolder</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem danger onClick={() => setConfirmingDelete(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      )}

      {addingChild && (
        <div style={{ paddingLeft: (depth + 1) * 16 }} className="px-3 py-1">
          <InlineTextForm
            placeholder="Subfolder name"
            onSubmit={(name) => {
              create.mutate({ name, parentId: node.id })
              setAddingChild(false)
            }}
            onCancel={() => setAddingChild(false)}
          />
        </div>
      )}

      {node.children.map((child) => (
        <CollectionTreeItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
      ))}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${node.name}"?`}
        description="Documents inside will move to All documents. Subfolders are deleted too. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(node.id)
          setConfirmingDelete(false)
          if (selectedId === node.id) onSelect(null)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
