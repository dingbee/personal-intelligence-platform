import { useState } from 'react'
import type { DocumentSort } from '@/modules/library/api/documents'
import { useCollections } from '@/modules/library/hooks/useCollections'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import { useTags } from '@/modules/library/hooks/useTags'
import { CollectionsPanelContent } from '@/modules/library/components/CollectionsPanelContent'
import { MobileCollectionsDrawer } from '@/modules/library/components/MobileCollectionsDrawer'
import { UploadDropzone } from '@/modules/library/components/UploadDropzone'
import { DocumentGrid } from '@/modules/library/components/DocumentGrid'
import { TagFilterBar } from '@/modules/library/components/TagFilterBar'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

const SORT_OPTIONS: { value: DocumentSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
  { value: 'largest', label: 'Largest file' },
  { value: 'smallest', label: 'Smallest file' },
]

export function LibraryPage() {
  const [collectionId, setCollectionId] = useState<string | null | undefined>(undefined)
  const [tagId, setTagId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DocumentSort>('newest')
  const [collectionsDrawerOpen, setCollectionsDrawerOpen] = useState(false)

  const { data: collections = [], isLoading: collectionsLoading } = useCollections()
  const { data: tags = [] } = useTags()
  const {
    data: documents = [],
    isLoading: documentsLoading,
    isError,
    error,
  } = useDocuments({ collectionId, tagId, search: search || undefined, sort })

  return (
    <div className="flex gap-8">
      <aside className="hidden w-56 shrink-0 md:block">
        <CollectionsPanelContent
          collections={collections}
          collectionsLoading={collectionsLoading}
          selectedId={collectionId ?? null}
          onSelect={(id) => setCollectionId(id ?? undefined)}
        />
      </aside>
      <MobileCollectionsDrawer
        open={collectionsDrawerOpen}
        onClose={() => setCollectionsDrawerOpen(false)}
        collections={collections}
        collectionsLoading={collectionsLoading}
        selectedId={collectionId ?? null}
        onSelect={(id) => setCollectionId(id ?? undefined)}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="mb-6">
          <div className="mb-2 md:hidden">
            <Button variant="ghost" onClick={() => setCollectionsDrawerOpen(true)}>
              ☰ Collections
            </Button>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Library</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Your documents, books, and collections live here.
          </p>
        </div>

        <div className="mb-6">
          <UploadDropzone collectionId={collectionId ?? null} />
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Input
            label="Search"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="library-sort" className="text-sm font-medium text-[var(--color-ink)]">
              Sort by
            </label>
            <select
              id="library-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as DocumentSort)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <TagFilterBar tags={tags} selectedTagId={tagId} onSelect={setTagId} />
        </div>

        {documentsLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="text-sm text-red-600">
            Couldn't load your documents: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </p>
            <DocumentGrid documents={documents} collections={collections} />
          </>
        )}
      </div>
    </div>
  )
}
