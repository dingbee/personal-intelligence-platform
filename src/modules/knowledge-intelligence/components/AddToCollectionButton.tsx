import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useKnowledgeCollections } from '@/modules/knowledge-intelligence/hooks/useKnowledgeCollections'
import { addItemToCollection, type CollectionItemType } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { Button } from '@/shared/components/ui/Button'

/**
 * UX-13 roadmap Phase 4 — a small self-contained popover, not
 * DropdownMenu: DropdownMenu closes on any click inside it (fine for a
 * menu of buttons, wrong here since this needs a text input for creating
 * a collection inline without the popover closing on focus).
 */
export function AddToCollectionButton({ itemType, itemId }: { itemType: CollectionItemType; itemId: string }) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const { data: collections = [], create } = useKnowledgeCollections()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [addedCollectionId, setAddedCollectionId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const add = useMutation({
    mutationFn: (collectionId: string) =>
      addItemToCollection({ userId: user!.id, workspaceId: currentWorkspaceId, collectionId, itemType, itemId }),
    onSuccess: (_, collectionId) => {
      setAddedCollectionId(collectionId)
      void queryClient.invalidateQueries({ queryKey: ['knowledge-collection-items', collectionId] })
    },
  })

  async function handleCreateAndAdd(name: string) {
    const collection = await create.mutateAsync({ name })
    await add.mutateAsync(collection.id)
    setCreatingNew(false)
    setNewName('')
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
        Add to collection
      </Button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 w-64 overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] p-2 shadow-floating">
          {collections.length > 0 && (
            <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
              {collections.map((collection) => (
                <li key={collection.id}>
                  <button
                    type="button"
                    onClick={() => add.mutate(collection.id)}
                    className="flex w-full items-center justify-between rounded-control px-2 py-1.5 text-left text-sm text-[var(--color-ink)] transition-colors hover:bg-[var(--surface-base)]"
                  >
                    <span className="truncate">{collection.name}</span>
                    {addedCollectionId === collection.id && <span className="text-[var(--color-accent)]">Added</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {collections.length === 0 && !creatingNew && (
            <p className="px-2 py-1.5 text-sm text-[var(--color-ink-muted)]">No collections yet.</p>
          )}
          {creatingNew ? (
            <form
              className="mt-1 flex items-center gap-1.5 px-1"
              onSubmit={(event) => {
                event.preventDefault()
                if (newName.trim()) void handleCreateAndAdd(newName.trim())
              }}
            >
              <input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Collection name"
                className="min-w-0 flex-1 rounded-control border border-[var(--color-border)] bg-[var(--surface-base)] px-2 py-1 text-sm text-[var(--color-ink)]"
              />
              <Button type="submit" loading={create.isPending || add.isPending} disabled={!newName.trim()}>
                Create
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="mt-1 w-full rounded-control px-2 py-1.5 text-left text-sm text-[var(--color-accent)] transition-colors hover:bg-[var(--surface-base)]"
            >
              + New collection
            </button>
          )}
        </div>
      )}
    </div>
  )
}
