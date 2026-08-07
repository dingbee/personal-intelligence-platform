import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAsset } from '@/modules/assets/hooks/useAsset'
import { useAssets } from '@/modules/assets/hooks/useAssets'
import { useAnalyzeImage } from '@/modules/assets/hooks/useAnalyzeImage'
import { useSignedAssetUrl } from '@/modules/assets/hooks/useSignedAssetUrl'
import { createNote } from '@/modules/notes/api/notes'
import { linkNoteToAsset } from '@/modules/notes/api/knowledgeLinks'
import { buildStructuredNoteContent } from '@/modules/assets/intelligence/buildStructuredNoteContent'
import { buildImageChatSeedQuery } from '@/modules/assets/intelligence/buildImageChatSeedQuery'
import { needsConfidenceReview } from '@/modules/assets/intelligence/assetConfidence'
import { AddToCollectionButton } from '@/modules/knowledge-intelligence/components/AddToCollectionButton'
import { exportAssetPackage } from '@/modules/knowledge-exchange/assets/exportAssetPackage'
import { fetchAssetOriginalAsBase64 } from '@/modules/knowledge-exchange/assets/assetFileTransfer'
import { buildAssetExportContent } from '@/modules/export/content/assetExportContent'
import { KnowledgeExportDialog } from '@/modules/export/components/KnowledgeExportDialog'
import { exportFilename } from '@/modules/export/types'
import { useAuth } from '@/modules/auth/useAuth'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { formatFileSize } from '@/modules/library/utils/fileTypes'
import { useWorkspaceRole } from '@/modules/workspaces/hooks/useWorkspaceRole'
import { useWorkspaceMemberDirectory } from '@/modules/workspaces/hooks/useWorkspaceMemberDirectory'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { Button } from '@/shared/components/ui/Button'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { SharingBadge } from '@/shared/components/collaboration/SharingBadge'
import { OwnershipLine } from '@/shared/components/collaboration/OwnershipLine'

type SidePanelTab = 'chat' | 'details'
const TABS: { id: SidePanelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'details', label: 'Details' },
]

const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3

/**
 * UX-13.9 — the "image reading workflow equivalent to the PDF Reader":
 * same shell ReaderPage/PdfReaderView established (header with zoom
 * controls, a scrollable main pane, a tabbed side panel), scaled down for
 * a single image with no pages. No text layer/canvas rendering needed —
 * it's already a real image, so zoom is a plain CSS transform on an
 * <img>, not a PDF-style re-render pipeline.
 *
 * Multimodal Intelligence v1 — the Chat tab's "Analyze with NOVA" action
 * (useAnalyzeImage) is the one place in this codebase NOVA actually looks
 * at an image's pixels (see docs/multimodal-intelligence-discovery.md).
 * The result is stored (asset.metadata) and fed into the same knowledge-
 * extraction chain documents use, not injected live into an ongoing chat
 * turn — "Ask NOVA about this image" still starts a normal text
 * conversation seeded with the image's title via the same
 * createConversationWithQuery command action other quick-start entry
 * points already use, so the copy here is careful not to claim NOVA can
 * see the image mid-conversation, only that it can be asked to look once.
 */
export function ImageReaderPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: asset, isLoading, isError } = useAsset(assetId!)
  const { rename, remove } = useAssets()
  const analyzeImage = useAnalyzeImage()
  const { createConversationWithQuery } = useCommandActions()
  const { data: imageUrl, isLoading: imageLoading } = useSignedAssetUrl(asset?.optimized_path)
  const { data: role } = useWorkspaceRole(asset?.workspace_id ?? null)
  const { isShared, lookup } = useWorkspaceMemberDirectory(asset?.workspace_id ?? null)

  const [activePanel, setActivePanel] = useState<SidePanelTab | null>('chat')
  const [zoom, setZoom] = useState(1)
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const saveAsNote = useMutation({
    mutationFn: async () => {
      const note = await createNote({ userId: user!.id, workspaceId: asset!.workspace_id, title: asset!.title })
      await linkNoteToAsset({ userId: user!.id, workspaceId: asset!.workspace_id, noteId: note.id, assetId: asset!.id })
      return note
    },
    onSuccess: (note) => navigate(`/notes/${note.id}`),
  })

  // Multimodal Intelligence v2 — the "Notes + Knowledge Nodes + Tasks"
  // conversion: unlike saveAsNote (an empty note seeded with just the
  // title), this renders the asset's analysis + extracted dates/decisions/
  // tasks (buildStructuredNoteContent) as real note content, tasks as a
  // markdown checklist rather than a first-class Task entity — see
  // docs/multimodal-intelligence-v2-discovery.md §9 for why.
  const saveStructuredNote = useMutation({
    mutationFn: async () => {
      const content = buildStructuredNoteContent({
        description: asset!.metadata!.description,
        documentIntelligence: asset!.metadata!.documentIntelligence,
      })
      const note = await createNote({ userId: user!.id, workspaceId: asset!.workspace_id, title: asset!.title, content })
      await linkNoteToAsset({ userId: user!.id, workspaceId: asset!.workspace_id, noteId: note.id, assetId: asset!.id })
      return note
    },
    onSuccess: (note) => navigate(`/notes/${note.id}`),
  })

  if (isLoading) {
    return (
      <div className="flex h-screen h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !asset) {
    return (
      <div className="p-8">
        <EmptyState title="Couldn't load this image" description="It may have been deleted." />
      </div>
    )
  }

  // UX-14.5 Phase 5 — mirrors ImageCard's gating exactly; assets use
  // owner_id, not user_id.
  const isAssetOwner = asset.owner_id === user?.id
  const canEdit = isAssetOwner || role === 'editor' || role === 'owner'
  const canDelete = isAssetOwner || role === 'owner'

  return (
    <div className="flex h-screen h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--color-border)] px-4">
        <Link to="/library" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Library
        </Link>
        <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-medium text-[var(--color-ink)]" title={asset.title}>
          <span className="truncate">{asset.title}</span>
          {isShared && <SharingBadge isShared />}
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-3 overflow-x-auto text-xs text-[var(--color-ink-muted)]">
          <div className="hidden items-center gap-1.5 md:flex">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100))}
              className="rounded-md px-2 py-1 hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))}
              className="rounded-md px-2 py-1 hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePanel(activePanel === tab.id ? null : tab.id)}
              className={`rounded-md px-2 py-1 font-medium ${
                activePanel === tab.id
                  ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]'
                  : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className={`flex flex-1 items-center justify-center overflow-auto p-6 ${activePanel !== null ? 'hidden md:flex' : ''}`}>
          {imageLoading ? (
            <Spinner />
          ) : imageUrl ? (
            // PIP Stabilization v1 (P1 mobile) — at the default zoom (1), fit
            // the image within its container instead of forcing native pixel
            // width: most photos are wider than a phone screen, so this used
            // to force horizontal scrolling on every image, every time,
            // unlike the PDF reader's fit-width default. Zooming in/out still
            // switches to an explicit pixel width, which is when
            // intentionally overflowing the container (to pan/scroll) is the
            // whole point.
            <img
              src={imageUrl}
              alt={asset.title}
              style={
                zoom === 1
                  ? { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }
                  : { width: `${asset.width * zoom}px`, maxWidth: 'none' }
              }
              className="shadow-raised"
            />
          ) : (
            <EmptyState title="Couldn't load this image" description="Try reloading the page." />
          )}
        </div>

        {activePanel !== null && (
          <aside className="w-full shrink-0 overflow-y-auto border-l border-[var(--color-border)] md:w-96">
            {activePanel === 'chat' && (
              <div className="flex flex-col gap-3 p-4">
                {asset.metadata ? (
                  <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-raised)] p-3">
                    {needsConfidenceReview(asset.metadata.confidence) && (
                      <p className="rounded-control bg-[var(--color-warning-bg)] px-2 py-1 text-xs text-[var(--color-warning-strong)]">
                        NOVA wasn't fully confident about parts of this analysis — worth a quick review before relying on it.
                      </p>
                    )}
                    <p className="text-xs font-medium text-[var(--color-ink-muted)]">What NOVA sees</p>
                    <p className="text-sm text-[var(--color-ink)]">{asset.metadata.description}</p>
                    {asset.metadata.extractedText && (
                      <>
                        <p className="text-xs font-medium text-[var(--color-ink-muted)]">
                          Visible text{asset.metadata.detectedLanguage ? ` (${asset.metadata.detectedLanguage})` : ''}
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-[var(--color-ink)]">{asset.metadata.extractedText}</p>
                      </>
                    )}
                    {asset.metadata.documentIntelligence &&
                      (asset.metadata.documentIntelligence.dates.length > 0 ||
                        asset.metadata.documentIntelligence.decisions.length > 0 ||
                        asset.metadata.documentIntelligence.tasks.length > 0) && (
                        <>
                          <p className="text-xs font-medium text-[var(--color-ink-muted)]">
                            Found {asset.metadata.documentIntelligence.dates.length} date
                            {asset.metadata.documentIntelligence.dates.length === 1 ? '' : 's'},{' '}
                            {asset.metadata.documentIntelligence.decisions.length} decision
                            {asset.metadata.documentIntelligence.decisions.length === 1 ? '' : 's'}, and{' '}
                            {asset.metadata.documentIntelligence.tasks.length} task
                            {asset.metadata.documentIntelligence.tasks.length === 1 ? '' : 's'}
                          </p>
                          <Button variant="secondary" loading={saveStructuredNote.isPending} onClick={() => saveStructuredNote.mutate()}>
                            Convert to structured note
                          </Button>
                        </>
                      )}
                    <Button variant="ghost" loading={analyzeImage.isPending} onClick={() => analyzeImage.mutate(asset)}>
                      Re-analyze
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      NOVA hasn't looked at this image yet — analyzing it adds a description and any visible text to
                      your knowledge graph.
                    </p>
                    <Button loading={analyzeImage.isPending} onClick={() => analyzeImage.mutate(asset)}>
                      Analyze with NOVA
                    </Button>
                    {analyzeImage.isError && (
                      <p className="text-sm text-[var(--color-danger)]">{(analyzeImage.error as Error).message}</p>
                    )}
                  </>
                )}
                <Button variant="secondary" onClick={() => void createConversationWithQuery(buildImageChatSeedQuery(asset.title, asset.metadata))}>
                  Ask NOVA about this image
                </Button>
              </div>
            )}
            {activePanel === 'details' && (
              <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--color-ink)]">Title</span>
                  {renaming ? (
                    <InlineTextForm
                      initialValue={asset.title}
                      onSubmit={(title) => {
                        rename.mutate({ id: asset.id, title })
                        setRenaming(false)
                      }}
                      onCancel={() => setRenaming(false)}
                    />
                  ) : canEdit ? (
                    <button type="button" onClick={() => setRenaming(true)} className="text-left text-sm text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                      {asset.title} <span className="text-xs text-[var(--color-ink-muted)]">(rename)</span>
                    </button>
                  ) : (
                    <span className="text-sm text-[var(--color-ink)]">{asset.title}</span>
                  )}
                </div>

                {isShared && (
                  <OwnershipLine ownerId={asset.owner_id} currentUserId={user?.id} owner={lookup(asset.owner_id)} isShared={isShared} />
                )}

                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-ink-muted)]">Dimensions</dt>
                    <dd className="text-[var(--color-ink)]">
                      {asset.width} × {asset.height}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-ink-muted)]">File size</dt>
                    <dd className="text-[var(--color-ink)]">{formatFileSize(asset.size_bytes)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-ink-muted)]">Type</dt>
                    <dd className="text-[var(--color-ink)]">{asset.mime_type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-ink-muted)]">Uploaded</dt>
                    <dd className="text-[var(--color-ink)]">{new Date(asset.created_at).toLocaleDateString()}</dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
                  <Button variant="secondary" loading={saveAsNote.isPending} onClick={() => saveAsNote.mutate()}>
                    Save as Notes
                  </Button>
                  <AddToCollectionButton itemType="asset" itemId={asset.id} />
                  {/* UX-15.1 — replaces the previous single-format, `.json`-
                      only Export button with the same unified Save As /
                      Download experience every other object type already
                      uses (UX-14.5.11/UX-14.5.12): NOVA Package (this
                      image's existing, unmodified `exportAssetPackage`),
                      PDF, Markdown, or Word. */}
                  <Button variant="ghost" onClick={() => setExportDialogOpen(true)}>
                    Save As…
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" className="text-[var(--color-danger)] hover:text-[var(--color-danger-strong)]" onClick={() => setConfirmingDelete(true)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${asset.title}"?`}
        description="This permanently removes the image from your library. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(asset, { onSuccess: () => navigate('/library') })
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />

      <KnowledgeExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        objectLabel="image"
        request={{
          content: buildAssetExportContent(asset),
          titleForFilename: asset.title,
          buildNovaPackage: async () => {
            const fileDataBase64 = await fetchAssetOriginalAsBase64(asset)
            const pkg = exportAssetPackage({ asset, fileDataBase64 })
            return {
              filename: exportFilename(asset.title, 'nova'),
              blob: new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }),
            }
          },
        }}
      />
    </div>
  )
}
