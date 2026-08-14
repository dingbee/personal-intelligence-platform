import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useDocument } from '@/modules/library/hooks/useDocument'
import { useCollections } from '@/modules/library/hooks/useCollections'
import { useDocumentMutations } from '@/modules/library/hooks/useDocumentMutations'
import { useProcessingJob } from '@/modules/processing/hooks/useProcessingJob'
import { useReprocessDocument } from '@/modules/processing/hooks/useReprocessDocument'
import { useExtractionMetadata } from '@/modules/processing/hooks/useExtractionMetadata'
import { useDocumentChunkCount } from '@/modules/processing/hooks/useDocumentChunkCount'
import { useWorkspaceRole } from '@/modules/workspaces/hooks/useWorkspaceRole'
import { useWorkspaceMemberDirectory } from '@/modules/workspaces/hooks/useWorkspaceMemberDirectory'
import { ProcessingStatusBadge } from '@/modules/processing/components/ProcessingStatusBadge'
import { KnowledgeExtractionPanel } from '@/modules/knowledge-intelligence/components/KnowledgeExtractionPanel'
import { DocumentIntelligencePanel } from '@/modules/processing/documentIntelligence/DocumentIntelligencePanel'
import { AddToCollectionButton } from '@/modules/knowledge-intelligence/components/AddToCollectionButton'
import { DocumentTagEditor } from '@/modules/library/components/DocumentTagEditor'
import { CollectionMoveSelect } from '@/modules/library/components/CollectionMoveSelect'
import { SpreadsheetSummaryCard } from '@/modules/library/components/SpreadsheetSummaryCard'
import { DataIntelligenceQueryPanel } from '@/modules/data-intelligence/components/DataIntelligenceQueryPanel'
import { AnalysisInvestigationPanel } from '@/modules/analysis-intelligence/components/AnalysisInvestigationPanel'
import { fileTypeLabel, formatFileSize } from '@/modules/library/utils/fileTypes'
import { exportDocumentPackage } from '@/modules/knowledge-exchange/documents/exportDocumentPackage'
import { buildDocumentPackageZip, fetchDocumentOriginalFile } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { buildDocumentExportContent } from '@/modules/export/content/documentExportContent'
import { KnowledgeExportDialog } from '@/modules/export/components/KnowledgeExportDialog'
import { exportFilename } from '@/modules/export/types'
import { resolveReaderMode } from '@/modules/reader/resolveReaderMode'
import { getSpreadsheetAnalysis } from '@/modules/processing/api/extractionMetadata'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { SharingBadge } from '@/shared/components/collaboration/SharingBadge'
import { OwnershipLine } from '@/shared/components/collaboration/OwnershipLine'

export function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const detailKey = ['document-detail', documentId]
  const invalidateDetail = () => queryClient.invalidateQueries({ queryKey: detailKey })

  const { user } = useAuth()
  const { data: document, isLoading, isError } = useDocument(documentId!)
  const { data: collections = [] } = useCollections()
  const { data: job } = useProcessingJob(documentId!)
  const { data: metadata } = useExtractionMetadata(documentId!)
  const { data: chunkCount } = useDocumentChunkCount(documentId!)
  const { rename, remove } = useDocumentMutations()
  const reprocess = useReprocessDocument()
  const { data: role } = useWorkspaceRole(document?.workspace_id ?? null)
  const { isShared, lookup } = useWorkspaceMemberDirectory(document?.workspace_id ?? null)

  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (isError || !document) {
    return (
      <EmptyState
        title="Document not found"
        description="It may have been deleted, or you don't have access to it."
        action={
          <Link to="/library">
            <Button variant="secondary">Back to Library</Button>
          </Link>
        }
      />
    )
  }

  const readerMode = resolveReaderMode(document.file_type)
  const spreadsheetAnalysis = readerMode === 'spreadsheet' ? getSpreadsheetAnalysis(metadata) : null
  // UX-14.5 Phase 5 — mirrors DocumentCard's gating exactly, since this
  // page previously offered every control unconditionally.
  const isDocumentOwner = document.user_id === user?.id
  const canEdit = isDocumentOwner || role === 'editor' || role === 'owner'
  const canDelete = isDocumentOwner || role === 'owner'

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/library" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Back to Library
      </Link>

      <div className="mt-4 flex flex-col gap-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
              {fileTypeLabel(document.file_type)}
            </span>
            {isShared && <SharingBadge isShared />}
          </span>
          {renaming ? (
            <div className="mt-1">
              <InlineTextForm
                initialValue={document.title}
                onSubmit={(title) => {
                  rename.mutate({ id: document.id, title }, { onSuccess: invalidateDetail })
                  setRenaming(false)
                }}
                onCancel={() => setRenaming(false)}
              />
            </div>
          ) : (
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-[var(--color-ink)]">
              {document.title}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="text-xs font-normal text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
                >
                  Rename
                </button>
              )}
            </h1>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-[var(--color-ink-muted)]">
            {formatFileSize(document.file_size)}
            {isShared && (
              <>
                {' · '}
                <OwnershipLine
                  ownerId={document.user_id}
                  currentUserId={user?.id}
                  owner={lookup(document.user_id)}
                  isShared={isShared}
                />
              </>
            )}
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Status</h2>
          <div className="mt-1.5 flex items-center gap-3">
            <ProcessingStatusBadge documentId={document.id} documentStatus={document.status} />
            {job?.status === 'failed' && canEdit && (
              <Button
                variant="secondary"
                onClick={() => reprocess.mutate(document.id)}
                loading={reprocess.isPending}
              >
                Retry processing
              </Button>
            )}
          </div>
          {job?.status === 'failed' && job.error_message && (
            <p className="mt-2 rounded-lg bg-[var(--color-canvas)] p-3 text-sm text-[var(--color-danger)]">
              {job.error_message}
            </p>
          )}
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Tags</h2>
          <div className="mt-1.5">
            <DocumentTagEditor documentId={document.id} tags={document.tags} onSuccess={invalidateDetail} />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Collection
          </h2>
          <div className="mt-1.5">
            <CollectionMoveSelect
              documentId={document.id}
              collectionId={document.collection_id}
              collections={collections}
              onSuccess={invalidateDetail}
            />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Metadata
          </h2>
          {metadata ? (
            <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <MetaRow label="Author" value={metadata.author} />
              <MetaRow label="Language" value={metadata.language} />
              <MetaRow label="Pages" value={metadata.page_count} />
              <MetaRow label="Chapters" value={metadata.chapter_count} />
              <MetaRow label="Words" value={metadata.word_count} />
              <MetaRow label="Characters" value={metadata.char_count} />
              <MetaRow label="Chunks" value={chunkCount ?? 0} />
              <MetaRow label="Created" value={new Date(document.created_at).toLocaleDateString()} />
              <MetaRow label="Updated" value={new Date(document.updated_at).toLocaleDateString()} />
            </dl>
          ) : (
            <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
              Metadata will appear once processing completes.
            </p>
          )}
        </div>

        {spreadsheetAnalysis && spreadsheetAnalysis.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Spreadsheet Analysis
            </h2>
            <div className="mt-1.5">
              <SpreadsheetSummaryCard
                analyses={spreadsheetAnalysis}
                lastUpdatedLabel={new Date(document.updated_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              />
            </div>
            <div className="mt-3">
              <DataIntelligenceQueryPanel documentId={document.id} workspaceId={document.workspace_id} />
            </div>
            <div className="mt-3">
              <AnalysisInvestigationPanel documentId={document.id} workspaceId={document.workspace_id} />
            </div>
          </div>
        )}

        {document.status === 'ready' && <KnowledgeExtractionPanel documentId={document.id} />}

        {document.status === 'ready' && (
          <DocumentIntelligencePanel documentId={document.id} documentIntelligence={metadata?.metadata.documentIntelligence ?? null} />
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
          {readerMode && document.status === 'ready' && (
            <Link to={`/library/${document.id}/read`}>
              <Button variant="secondary">Read</Button>
            </Link>
          )}
          {document.status === 'ready' && (
            <Link to={`/chat?documentId=${document.id}`}>
              <Button variant="secondary">Chat about this document</Button>
            </Link>
          )}
          <AddToCollectionButton itemType="document" itemId={document.id} />
          {/* UX-15.1 — replaces the previous single-format, `.zip`-only
              Export button with the same unified Save As / Download
              experience every other object type already uses (UX-14.5.11/
              UX-14.5.12): NOVA Package (this document's existing,
              unmodified `exportDocumentPackage`), PDF, Markdown, or Word. */}
          <Button variant="ghost" onClick={() => setExportDialogOpen(true)}>
            Save As…
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              className="text-[var(--color-danger)] hover:text-[var(--color-danger-strong)]"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${document.title}"?`}
        description="This permanently removes the file from your library. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(
            { id: document.id, filePath: document.file_path },
            { onSuccess: () => navigate('/library') },
          )
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />

      <KnowledgeExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        objectLabel="document"
        request={{
          content: buildDocumentExportContent(document, metadata ?? null),
          titleForFilename: document.title,
          buildNovaPackage: async () => {
            const originalFile = await fetchDocumentOriginalFile(document)
            const manifest = exportDocumentPackage({ document, tags: document.tags })
            const zipBlob = await buildDocumentPackageZip(manifest, originalFile)
            return { filename: exportFilename(document.title, 'nova'), blob: zipBlob }
          },
        }}
      />
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="text-[var(--color-ink)]">{value ?? '—'}</dd>
    </>
  )
}
