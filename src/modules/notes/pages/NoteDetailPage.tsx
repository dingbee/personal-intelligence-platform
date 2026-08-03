import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useNote } from '@/modules/notes/hooks/useNote'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { useNoteTags } from '@/modules/notes/hooks/useNoteTags'
import { useRelatedKnowledge } from '@/modules/notes/hooks/useRelatedKnowledge'
import { exportNotePackage } from '@/modules/knowledge-exchange/notes/exportNotePackage'
import { buildNoteExportContent } from '@/modules/export/content/noteExportContent'
import { KnowledgeExportDialog } from '@/modules/export/components/KnowledgeExportDialog'
import { exportFilename } from '@/modules/export/types'
import { useWorkspaceRole } from '@/modules/workspaces/hooks/useWorkspaceRole'
import { useWorkspaceMemberDirectory } from '@/modules/workspaces/hooks/useWorkspaceMemberDirectory'
import { SharingBadge } from '@/shared/components/collaboration/SharingBadge'
import { OwnershipLine } from '@/shared/components/collaboration/OwnershipLine'
import { NoteTagEditor } from '@/modules/notes/components/NoteTagEditor'
import { AddToCollectionButton } from '@/modules/knowledge-intelligence/components/AddToCollectionButton'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { KnowledgeCard } from '@/shared/components/knowledge/KnowledgeCard'
import { SourceReference } from '@/shared/components/knowledge/SourceReference'
import { getArtifactData, getArtifactKind, getCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'
import { ARTIFACT_CREATION_METHOD_LABELS, ARTIFACT_KIND_DEFINITIONS } from '@/modules/ai/artifacts/artifactTypes'
import type { SpreadsheetArtifactData } from '@/modules/ai/artifacts/spreadsheet/types'

// UX-14.4 Phase 2 — lazy-loaded for the same reason PdfReaderView/
// SpreadsheetReaderView already are (see ReaderPage.tsx): `xlsx` is a
// genuinely large dependency, and a static import here would pull it into
// every page's bundle even for the overwhelming majority of notes that
// are never a spreadsheet artifact.
const SpreadsheetArtifactPanel = lazy(() =>
  import('@/modules/notes/components/SpreadsheetArtifactPanel').then((m) => ({ default: m.SpreadsheetArtifactPanel })),
)

export function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { note, isLoading, isError, save, summarize } = useNote(noteId!)
  const { remove } = useNotes()
  const { tags: noteTags } = useNoteTags(noteId!)
  const { data: documents = [] } = useDocuments({})
  const { data: relatedKnowledge = [] } = useRelatedKnowledge(noteId!)
  const { createConversationWithQuery } = useCommandActions()
  const { data: workspaceRole } = useWorkspaceRole(note?.workspace_id ?? null)
  const { isShared, lookup } = useWorkspaceMemberDirectory(note?.workspace_id ?? null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingSummarize, setConfirmingSummarize] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // Sync local editing state whenever the loaded note changes (initial load,
  // or after Summarize overwrites content) — not on every keystroke, since
  // this effect only re-runs when the fetched `note` object identity changes.
  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content)
      setDocumentId(note.document_id)
    }
  }, [note])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (isError || !note) {
    return (
      <EmptyState
        title="Note not found"
        description="It may have been deleted."
        action={
          <Link to="/notes">
            <Button variant="secondary">Back to Notes</Button>
          </Link>
        }
      />
    )
  }

  const isDirty = title !== note.title || content !== note.content || documentId !== note.document_id
  // UX-14.5 Phase 2 — a shared note's editability follows the resolved
  // workspace role, not just row ownership: the note's own creator always
  // keeps full rights (matches pre-sharing behavior exactly), a workspace
  // owner also gets full control (design doc §2/§4), an editor can save/
  // summarize but not delete, and a viewer gets neither — mirroring the
  // notes RLS policies (0029_note_sharing.sql) so the UI never offers a
  // control the database would reject.
  const isNoteOwner = note.user_id === user?.id
  const canEdit = isNoteOwner || workspaceRole === 'editor' || workspaceRole === 'owner'
  const canDelete = isNoteOwner || workspaceRole === 'owner'
  const artifactKind = getArtifactKind(note)
  const spreadsheetArtifactData = artifactKind === 'spreadsheet' ? getArtifactData<SpreadsheetArtifactData>(note) : null
  const creationMethod = getCreationMethod(note)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Link to="/notes" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Back to Notes
        </Link>
        <div className="flex items-center gap-2">
          {isShared && <SharingBadge isShared />}
          {/* UX-14.4.4 — creationMethod has been written into generation_metadata
              since UX-14.4.3, but nothing displayed it until now: a real
              write/read gap, not a cosmetic addition. */}
          {creationMethod && (
            <span className="text-xs text-[var(--color-ink-muted)]">{ARTIFACT_CREATION_METHOD_LABELS[creationMethod]}</span>
          )}
        </div>
      </div>

      {isShared && (
        <OwnershipLine ownerId={note.user_id} currentUserId={user?.id} owner={lookup(note.user_id)} isShared={isShared} />
      )}

      {/* UX-14.4 Phase 1 — Knowledge Card activation: the Phase 7B rendering
          primitives already exist, this is the first note-facing surface
          that puts them to use, for the one kind that's genuinely a
          compact-summary artifact rather than free-form prose. */}
      {artifactKind === 'knowledge_card' && (
        <KnowledgeCard title={note.title} typeLabel={ARTIFACT_KIND_DEFINITIONS.knowledge_card.label} description={note.content} />
      )}

      {/* UX-14.4 Phase 2 (Path A) — preview + download for a spreadsheet
          artifact's structured payload, when Save As's markdown-table
          parser produced one. A note tagged `spreadsheet` with no parsed
          table (e.g. picked manually on prose) renders no panel here —
          nothing to preview or export yet. */}
      {spreadsheetArtifactData && (
        <Suspense
          fallback={
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          }
        >
          <SpreadsheetArtifactPanel title={note.title} data={spreadsheetArtifactData} />
        </Suspense>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="note-content" className="text-sm font-medium text-[var(--color-ink)]">
            Content
          </label>
          <textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
          Linked document
          <select
            value={documentId ?? ''}
            onChange={(e) => setDocumentId(e.target.value || null)}
            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-ink)]"
          >
            <option value="">None</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-ink)]">Tags</span>
          <NoteTagEditor noteId={note.id} />
        </div>

        {note.source_chunk_ids && note.source_chunk_ids.length > 0 && (
          <p className="text-xs text-[var(--color-ink-muted)]">
            Sourced from {note.source_chunk_ids.length} passage{note.source_chunk_ids.length === 1 ? '' : 's'} in{' '}
            {documents.find((document) => document.id === note.document_id)?.title ?? 'a document'}.
          </p>
        )}

        {/* UX-14.4.4 — linkKnownConceptsToSource has recorded this
            relationship for every saved note since Phase 2B; this is the
            first surface that reads it back. Reuses SourceReference
            unchanged (the same "provenance chips" primitive Evidence/
            Collections already use), so a related concept looks identical
            here to everywhere else it appears. */}
        {relatedKnowledge.length > 0 && <SourceReference sources={relatedKnowledge} label="Related knowledge:" />}

        {!canEdit && (
          <p className="text-xs text-[var(--color-ink-muted)]">You have view-only access to this note.</p>
        )}

        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Button
                  loading={save.isPending}
                  disabled={!isDirty}
                  onClick={() => save.mutate({ title, content, documentId })}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  loading={summarize.isPending}
                  disabled={!content.trim()}
                  onClick={() => setConfirmingSummarize(true)}
                >
                  Summarize
                </Button>
              </>
            )}
            <AddToCollectionButton itemType="note" itemId={note.id} />
            {/* UX-14.5.11 — replaces the previous single-format "Export"
                button with the unified Save As / Download experience:
                NOVA Package (this note's existing, unmodified
                `exportNotePackage`), PDF, Markdown, or Word. */}
            <Button variant="ghost" onClick={() => setExportDialogOpen(true)}>
              Save As…
            </Button>
            {/* UX-15.1 — converges "Ask AI" onto the one mechanism/label
                every other object type's own entry point uses
                (`createConversationWithQuery`, same as Assets). */}
            <Button variant="ghost" onClick={() => void createConversationWithQuery(`I'd like to talk about a note called "${note.title}".`)}>
              Ask NOVA about this note
            </Button>
          </div>
          {canDelete && (
            <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
        {summarize.isError && (
          <p className="text-sm text-red-600">
            {summarize.error instanceof Error ? summarize.error.message : 'Failed to summarize'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmingSummarize}
        title="Replace content with a summary?"
        description="This uses AI to condense the current content. The existing text will be replaced — save first if you want to keep it."
        confirmLabel="Summarize"
        onConfirm={() => {
          summarize.mutate(content)
          setConfirmingSummarize(false)
        }}
        onCancel={() => setConfirmingSummarize(false)}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${note.title}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(note.id, { onSuccess: () => navigate('/notes') })
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />

      <KnowledgeExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        objectLabel="note"
        request={{
          content: buildNoteExportContent(note, noteTags),
          titleForFilename: note.title,
          buildNovaPackage: async () => ({
            filename: exportFilename(note.title, 'nova'),
            blob: new Blob([JSON.stringify(exportNotePackage(note, noteTags), null, 2)], { type: 'application/json' }),
          }),
        }}
      />
    </div>
  )
}
