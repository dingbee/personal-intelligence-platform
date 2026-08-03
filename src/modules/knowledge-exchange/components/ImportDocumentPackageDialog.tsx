import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useImportDocumentPackage } from '@/modules/knowledge-exchange/hooks/useImportDocumentPackage'
import { parseDocumentPackageZip } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import type { ValidatedDocumentPackage } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import type { PackageValidationIssue } from '@/modules/knowledge-exchange/packages/PackageValidator'
import { fileTypeLabel, formatFileSize } from '@/modules/library/utils/fileTypes'
import { ProcessingStatusBadge } from '@/modules/processing/components/ProcessingStatusBadge'
import { Button } from '@/shared/components/ui/Button'

export interface ImportDocumentPackageDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * UX-14.5.10.3.2 — file picker → validation summary → workspace selector
 * → success summary, the same `<dialog>` shell `ImportNotePackageDialog`/
 * `ImportKnowledgeNodePackageDialog`/`ImportAssetPackageDialog` already
 * established (native `showModal()`/`close()`, reset-on-reopen). The one
 * genuinely new affordance: the file picker accepts `.zip`, not `.json`
 * — Documents is the first package type whose downloadable artifact is
 * binary (UX-14.5.10.3.1) — and `handleFileChange` awaits
 * `parseDocumentPackageZip`, which is async (reading a zip archive isn't
 * a synchronous `JSON.parse`).
 *
 * Always creates a brand-new document in the importer's account — never
 * overwrites anything they already have, mirroring Notes'/Assets'
 * always-create behavior (there's no meaningful "same document" identity
 * to dedupe against, unlike Knowledge Nodes).
 *
 * The success screen shows a live `ProcessingStatusBadge` for the newly
 * created document — reused unmodified, exactly the same polling UI a
 * native upload's Library card already shows — because unlike every
 * prior package type, "import" here is only "structurally done" the
 * moment this dialog's mutation resolves; the document is only usably
 * done once `processDocument` (fired inside `importDocumentPackage`)
 * finishes regenerating its chunks/embeddings/extraction metadata.
 */
export function ImportDocumentPackageDialog({ open, onClose }: ImportDocumentPackageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { workspaces, currentWorkspaceId } = useWorkspace()
  const importPackage = useImportDocumentPackage()

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedPackage, setParsedPackage] = useState<ValidatedDocumentPackage | null>(null)
  const [issues, setIssues] = useState<PackageValidationIssue[]>([])
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(currentWorkspaceId)
  const [importedDocumentId, setImportedDocumentId] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    setFileName(null)
    setParsedPackage(null)
    setIssues([])
    setTargetWorkspaceId(currentWorkspaceId)
    setImportedDocumentId(null)
    importPackage.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentWorkspaceId])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFileName(file.name)
    setParsedPackage(null)
    setImportedDocumentId(null)
    importPackage.reset()

    const result = await parseDocumentPackageZip(file)
    if (result.valid) {
      setParsedPackage(result.package)
      setIssues([])
    } else {
      setParsedPackage(null)
      setIssues(result.issues)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      className="w-full max-w-lg rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] p-6 shadow-floating backdrop:bg-black/30"
    >
      {importedDocumentId ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Document imported</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            "{parsedPackage?.manifest.document.title}" was imported as a new document in your account.
          </p>
          <div className="flex items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
            <span className="text-sm font-medium text-[var(--color-ink)]">Processing:</span>
            <ProcessingStatusBadge documentId={importedDocumentId} documentStatus="uploaded" />
          </div>
          <div className="flex justify-end gap-2">
            <Link to={`/library/${importedDocumentId}`} className="text-sm text-[var(--color-accent)] hover:underline">
              View document →
            </Link>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Import a document package</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Choose a <code>.zip</code> file exported from a document's Export button. It becomes a brand-new document
            in your account — it never overwrites anything you already have.
          </p>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Package file</span>
            <input
              type="file"
              accept="application/zip,.zip"
              onChange={(event) => void handleFileChange(event)}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] shadow-inset outline-none"
            />
          </label>

          {fileName && issues.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-control border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-700">Couldn't import "{fileName}":</p>
              <ul className="list-inside list-disc text-sm text-red-600">
                {issues.map((issueItem, index) => (
                  <li key={index}>{issueItem.message}</li>
                ))}
              </ul>
            </div>
          )}

          {parsedPackage && (
            <div className="flex flex-col gap-1.5 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
              <p className="text-sm font-medium text-[var(--color-ink)]">{parsedPackage.manifest.document.title}</p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {fileTypeLabel(parsedPackage.manifest.document.fileType)} · {formatFileSize(parsedPackage.manifest.document.sizeBytes)}
              </p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {parsedPackage.manifest.document.tags.length > 0
                  ? `Tags: ${parsedPackage.manifest.document.tags.join(', ')}`
                  : 'No tags'}
              </p>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Import into workspace</span>
            <select
              value={targetWorkspaceId ?? ''}
              onChange={(e) => setTargetWorkspaceId(e.target.value || null)}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] shadow-inset outline-none"
            >
              <option value="">No workspace</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>

          {importPackage.isError && (
            <p className="text-sm text-red-600">
              {importPackage.error instanceof Error ? importPackage.error.message : 'Failed to import this package.'}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={importPackage.isPending}
              disabled={!parsedPackage}
              onClick={() => {
                if (!parsedPackage) return
                importPackage.mutate(
                  { pkg: parsedPackage, workspaceId: targetWorkspaceId },
                  { onSuccess: (document) => setImportedDocumentId(document.id) },
                )
              }}
            >
              Import
            </Button>
          </div>
        </div>
      )}
    </dialog>
  )
}
