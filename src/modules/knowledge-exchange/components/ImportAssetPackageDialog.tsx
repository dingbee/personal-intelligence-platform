import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useImportAssetPackage } from '@/modules/knowledge-exchange/hooks/useImportAssetPackage'
import { parseAssetPackage } from '@/modules/knowledge-exchange/assets/validateAssetPackage'
import type { AssetPackage } from '@/modules/knowledge-exchange/assets/assetPackageTypes'
import type { PackageValidationIssue } from '@/modules/knowledge-exchange/packages/PackageValidator'
import { Button } from '@/shared/components/ui/Button'

export interface ImportAssetPackageDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * UX-14.5.10.2 — file picker → validation summary → workspace selector →
 * success summary, the same `<dialog>` shell `ImportNotePackageDialog`/
 * `ImportKnowledgeNodePackageDialog` already established (native
 * `showModal()`/`close()`, reset-on-reopen). Always creates a brand-new
 * image in the importer's account — never overwrites anything they
 * already have, mirroring Notes' always-create behavior (there's no
 * meaningful "same asset" identity to dedupe against, unlike Knowledge
 * Nodes).
 */
export function ImportAssetPackageDialog({ open, onClose }: ImportAssetPackageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { workspaces, currentWorkspaceId } = useWorkspace()
  const importPackage = useImportAssetPackage()

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedPackage, setParsedPackage] = useState<AssetPackage | null>(null)
  const [issues, setIssues] = useState<PackageValidationIssue[]>([])
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(currentWorkspaceId)
  const [importedAssetId, setImportedAssetId] = useState<string | null>(null)

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
    setImportedAssetId(null)
    importPackage.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentWorkspaceId])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFileName(file.name)
    setParsedPackage(null)
    setImportedAssetId(null)
    importPackage.reset()

    const text = await file.text()
    const result = parseAssetPackage(text)
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
      {importedAssetId ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Image imported</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            "{parsedPackage?.asset.title}" was imported as a new image in your account.
          </p>
          <div className="flex justify-end gap-2">
            <Link to={`/library/assets/${importedAssetId}`} className="text-sm text-[var(--color-accent)] hover:underline">
              View image →
            </Link>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Import an image package</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Choose a <code>.json</code> file exported from an image's Export button. It becomes a brand-new image in
            your account — it never overwrites anything you already have.
          </p>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Package file</span>
            <input
              type="file"
              accept="application/json,.json"
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
              <p className="text-sm font-medium text-[var(--color-ink)]">{parsedPackage.asset.title || 'Untitled image'}</p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {parsedPackage.asset.mimeType} · {parsedPackage.asset.width}×{parsedPackage.asset.height}
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
                  { onSuccess: (asset) => setImportedAssetId(asset.id) },
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
