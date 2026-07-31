import { useState } from 'react'
import type { DocumentSort } from '@/modules/library/api/documents'
import { useCollections } from '@/modules/library/hooks/useCollections'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import { useTags } from '@/modules/library/hooks/useTags'
import { useAssets } from '@/modules/assets/hooks/useAssets'
import { CollectionsPanelContent } from '@/modules/library/components/CollectionsPanelContent'
import { MobileCollectionsDrawer } from '@/modules/library/components/MobileCollectionsDrawer'
import { UploadDropzone } from '@/modules/library/components/UploadDropzone'
import { DocumentGrid } from '@/modules/library/components/DocumentGrid'
import { TagFilterBar } from '@/modules/library/components/TagFilterBar'
import { AssetUploadDropzone } from '@/modules/assets/components/AssetUploadDropzone'
import { ImageGrid } from '@/modules/assets/components/ImageGrid'
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

type LibraryTab = 'documents' | 'images'

export function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('documents')
  const [collectionId, setCollectionId] = useState<string | null | undefined>(undefined)
  const [tagId, setTagId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DocumentSort>('newest')
  const [collectionsDrawerOpen, setCollectionsDrawerOpen] = useState(false)
  const [imageSearch, setImageSearch] = useState('')

  const { data: collections = [], isLoading: collectionsLoading } = useCollections()
  const { data: tags = [] } = useTags()
  const {
    data: documents = [],
    isLoading: documentsLoading,
    isError,
    error,
  } = useDocuments({ collectionId, tagId, search: search || undefined, sort })

  // UX-13.9 — workspace-scoped by useAssets itself (currentWorkspaceId
  // from context), the same scoping that makes this tab the "workspace
  // asset management" surface rather than needing a separate page.
  const { assets, isLoading: assetsLoading, isError: assetsIsError } = useAssets({ search: imageSearch || undefined })

  return (
    <div className="flex gap-8">
      {activeTab === 'documents' && (
        <>
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
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="mb-6">
          {activeTab === 'documents' && (
            <div className="mb-2 md:hidden">
              <Button variant="ghost" onClick={() => setCollectionsDrawerOpen(true)}>
                ☰ Collections
              </Button>
            </div>
          )}
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Library</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Your documents, books, images, and collections live here.
          </p>
          <div className="mt-4 flex gap-1 border-b border-[var(--color-border)]">
            {(['documents', 'images'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                    : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'documents' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="mb-6">
              <AssetUploadDropzone />
            </div>

            <div className="mb-4">
              <Input
                label="Search"
                placeholder="Search by title..."
                value={imageSearch}
                onChange={(e) => setImageSearch(e.target.value)}
                className="sm:w-64"
              />
            </div>

            {assetsLoading ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : assetsIsError ? (
              <p className="text-sm text-red-600">Couldn't load your images.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
                  {assets.length} {assets.length === 1 ? 'image' : 'images'}
                </p>
                <ImageGrid assets={assets} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
