import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { Collection } from '@/shared/types/database'
import type { DocumentWithTags } from '@/modules/library/api/documents'
import { useDocumentMutations } from '@/modules/library/hooks/useDocumentMutations'
import { useReprocessDocument } from '@/modules/processing/hooks/useReprocessDocument'
import { ProcessingStatusBadge } from '@/modules/processing/components/ProcessingStatusBadge'
import { fileTypeLabel, formatFileSize } from '@/modules/library/utils/fileTypes'
import { resolveReaderMode } from '@/modules/reader/resolveReaderMode'
import { createNote } from '@/modules/notes/api/notes'
import { useAuth } from '@/modules/auth/useAuth'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { DocumentTagEditor } from '@/modules/library/components/DocumentTagEditor'
import { CollectionMoveSelect } from '@/modules/library/components/CollectionMoveSelect'

export function DocumentCard({
  document,
  collections,
}: {
  document: DocumentWithTags
  collections: Collection[]
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { rename, remove } = useDocumentMutations()
  const reprocess = useReprocessDocument()
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const readerMode = resolveReaderMode(document.file_type)
  const isReady = document.status === 'ready'

  // UX-13.8.1 — "Save as Notes" from the Library: creates an empty note
  // already linked to this document (documentId, same field
  // HighlightsList's createNoteFromHighlight sets) and opens it for
  // editing, rather than fabricating AI-generated content no capability
  // actually produced. Calls createNote directly instead of useNotes()'s
  // create — that hook binds workspaceId to whichever workspace is
  // currently active, but the correct workspace for this note is the
  // document's own, which may not be the same one.
  const saveAsNote = useMutation({
    mutationFn: () => createNote({ userId: user!.id, workspaceId: document.workspace_id, title: document.title, documentId: document.id }),
    onSuccess: (note) => navigate(`/notes/${note.id}`),
  })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
            {fileTypeLabel(document.file_type)}
          </span>
          {renaming ? (
            <div className="mt-1">
              <InlineTextForm
                initialValue={document.title}
                onSubmit={(title) => {
                  rename.mutate({ id: document.id, title })
                  setRenaming(false)
                }}
                onCancel={() => setRenaming(false)}
              />
            </div>
          ) : (
            <h3 className="mt-1 truncate font-medium text-[var(--color-ink)]" title={document.title}>
              {document.title}
            </h3>
          )}
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
            {formatFileSize(document.file_size)} ·{' '}
            <ProcessingStatusBadge documentId={document.id} documentStatus={document.status} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* UX-13.8.1 — Read and Chat promoted to one-click, always-visible
              actions instead of being hidden inside the ⋯ menu: a user
              should never need Search to get back into their own document.
              Read is format-aware (resolveReaderMode), not EPUB-only. */}
          {isReady && readerMode && (
            <Link
              to={`/library/${document.id}/read`}
              className="rounded-md bg-[var(--color-canvas)] px-2 py-1 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              Read
            </Link>
          )}
          {isReady && (
            <Link
              to={`/chat?documentId=${document.id}`}
              className="rounded-md bg-[var(--color-canvas)] px-2 py-1 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              Chat
            </Link>
          )}
          <DropdownMenu trigger={<span aria-hidden>⋯</span>}>
            <Link
              to={`/library/${document.id}`}
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
            >
              View details
            </Link>
            {isReady && readerMode && (
              <Link
                to={`/library/${document.id}/read`}
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
              >
                Read Document
              </Link>
            )}
            {isReady && (
              <Link
                to={`/chat?documentId=${document.id}`}
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
              >
                Chat with NOVA
              </Link>
            )}
            {isReady && readerMode && (
              <Link
                to={`/library/${document.id}/read?panel=summary`}
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
              >
                Summarize
              </Link>
            )}
            {isReady && (
              <DropdownMenuItem onClick={() => saveAsNote.mutate()}>
                {saveAsNote.isPending ? 'Saving…' : 'Save as Notes'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => reprocess.mutate(document.id)}>
              {document.status === 'error' ? 'Retry processing' : 'Reprocess'}
            </DropdownMenuItem>
            <DropdownMenuItem danger onClick={() => setConfirmingDelete(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>

      <DocumentTagEditor documentId={document.id} tags={document.tags} />

      <CollectionMoveSelect
        documentId={document.id}
        collectionId={document.collection_id}
        collections={collections}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${document.title}"?`}
        description="This permanently removes the file from your library. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate({ id: document.id, filePath: document.file_path })
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
