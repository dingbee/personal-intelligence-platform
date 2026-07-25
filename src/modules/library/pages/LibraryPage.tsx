import { useState } from 'react'
import { useCollections } from '@/modules/library/hooks/useCollections'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import { useTags } from '@/modules/library/hooks/useTags'
import { CollectionTree } from '@/modules/library/components/CollectionTree'
import { UploadDropzone } from '@/modules/library/components/UploadDropzone'
import { DocumentGrid } from '@/modules/library/components/DocumentGrid'
import { TagFilterBar } from '@/modules/library/components/TagFilterBar'
import { Input } from '@/shared/components/ui/Input'
import { Spinner } from '@/shared/components/ui/Spinner'

export function LibraryPage() {
  const [collectionId, setCollectionId] = useState<string | null | undefined>(undefined)
  const [tagId, setTagId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: collections = [], isLoading: collectionsLoading } = useCollections()
  const { data: tags = [] } = useTags()
  const {
    data: documents = [],
    isLoading: documentsLoading,
    isError,
    error,
  } = useDocuments({ collectionId, tagId, search: search || undefined })

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
          />
        )}
      </aside>

      <div className="min-w-0 flex-1 flex-col gap-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Library</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Your documents, books, and collections live here.
          </p>
        </div>

        <div className="mb-6">
          <UploadDropzone collectionId={collectionId ?? null} />
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

        {documentsLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="text-sm text-red-600">
            Couldn't load your documents: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        ) : (
          <DocumentGrid documents={documents} collections={collections} />
        )}
      </div>
    </div>
  )
}
