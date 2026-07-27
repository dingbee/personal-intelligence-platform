import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollections } from '@/modules/library/hooks/useCollections'
import { CollectionTree } from '@/modules/library/components/CollectionTree'
import { useTags } from '@/modules/library/hooks/useTags'
import { TagFilterBar } from '@/shared/components/tags/TagFilterBar'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { useNoteMutations } from '@/modules/notes/hooks/useNoteMutations'
import { NoteGrid } from '@/modules/notes/components/NoteGrid'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

export function NotesPage() {
  const navigate = useNavigate()
  const [collectionId, setCollectionId] = useState<string | null | undefined>(undefined)
  const [tagId, setTagId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: collections = [], isLoading: collectionsLoading } = useCollections()
  const { data: tags = [] } = useTags()
  const { data: notes = [], isLoading: notesLoading, isError, error } = useNotes({ search: search || undefined })
  const { create } = useNoteMutations()

  const filteredNotes = notes.filter((note) => {
    const matchesCollection = collectionId === undefined || note.collection_id === collectionId
    const matchesTag = !tagId || note.tags.some((tag) => tag.id === tagId)
    return matchesCollection && matchesTag
  })

  async function handleNew() {
    const created = await create.mutateAsync({ collectionId: collectionId ?? null })
    void navigate(`/notes/${created.id}`)
  }

  return (
    <div className="flex gap-8">
      <aside className="w-56 shrink-0">
        <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Collections
        </h2>
        {collectionsLoading ? (
          <Spinner size="sm" />
        ) : (
          <CollectionTree
            collections={collections}
            selectedId={collectionId ?? null}
            onSelect={(id) => setCollectionId(id ?? undefined)}
            rootLabel="All notes"
            itemsLabel="Notes"
          />
        )}
      </aside>

      <div className="min-w-0 flex-1 flex-col gap-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Notes</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Rich notes that stay searchable alongside your documents.
            </p>
          </div>
          <Button onClick={() => void handleNew()} loading={create.isPending}>
            New note
          </Button>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            label="Search"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
          />
          <TagFilterBar tags={tags} selectedTagId={tagId} onSelect={setTagId} />
        </div>

        {notesLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="text-sm text-red-600">
            Couldn't load your notes: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        ) : (
          <NoteGrid notes={filteredNotes} collections={collections} />
        )}
      </div>
    </div>
  )
}
