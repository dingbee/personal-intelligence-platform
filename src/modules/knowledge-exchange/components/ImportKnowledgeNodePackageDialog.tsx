import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useImportKnowledgeNodePackage } from '@/modules/knowledge-exchange/hooks/useImportKnowledgeNodePackage'
import { parseKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/validateKnowledgeNodePackage'
import type { KnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/knowledgeNodePackageTypes'
import type { ImportKnowledgeNodePackageResult } from '@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage'
import type { PackageValidationIssue } from '@/modules/knowledge-exchange/packages/PackageValidator'
import { Button } from '@/shared/components/ui/Button'
import { Dialog } from '@/shared/components/ui/Dialog'

export interface ImportKnowledgeNodePackageDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * UX-14.5.10.1 — file picker → validation summary → workspace selector →
 * success summary, the exact same `<dialog>` shell `ImportNotePackageDialog`
 * already established. One difference from Notes: the success screen
 * distinguishes "created a new concept/entity" from "matched an existing
 * one" (the canonical-node-resolver dedup outcome), since — unlike a
 * note, which always inserts a fresh row — an import that lands on an
 * already-existing title in the destination account is a real,
 * user-visible outcome worth naming, not silently identical to a create.
 */
export function ImportKnowledgeNodePackageDialog({ open, onClose }: ImportKnowledgeNodePackageDialogProps) {
  const { workspaces, currentWorkspaceId } = useWorkspace()
  const importPackage = useImportKnowledgeNodePackage()

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedPackage, setParsedPackage] = useState<KnowledgeNodePackage | null>(null)
  const [issues, setIssues] = useState<PackageValidationIssue[]>([])
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(currentWorkspaceId)
  const [importResult, setImportResult] = useState<ImportKnowledgeNodePackageResult | null>(null)

  useEffect(() => {
    if (!open) return
    setFileName(null)
    setParsedPackage(null)
    setIssues([])
    setTargetWorkspaceId(currentWorkspaceId)
    setImportResult(null)
    importPackage.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentWorkspaceId])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFileName(file.name)
    setParsedPackage(null)
    setImportResult(null)
    importPackage.reset()

    const text = await file.text()
    const result = parseKnowledgeNodePackage(text)
    if (result.valid) {
      setParsedPackage(result.package)
      setIssues([])
    } else {
      setParsedPackage(null)
      setIssues(result.issues)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      {importResult ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            {importResult.created ? 'Knowledge node imported' : 'Matched an existing concept'}
          </h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {importResult.created ? (
              <>"{importResult.node.title}" was imported as a new {importResult.node.node_type} in your account.</>
            ) : (
              <>
                You already have a {importResult.node.node_type} titled "{importResult.node.title}" — its existing content
                was kept, and this import was recorded as an additional source.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Link to={`/knowledge/nodes/${importResult.node.id}`} className="text-sm text-[var(--color-accent)] hover:underline">
              View node →
            </Link>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Import a knowledge node package</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Choose a <code>.nova</code> (or older <code>.json</code>) file exported from a concept or entity's Save As
            dialog. It becomes a brand-new node in your account, or is matched to one you already have with the same
            title — it never overwrites an existing node's content.
          </p>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Package file</span>
            <input
              type="file"
              accept="application/json,.json,.nova"
              onChange={(event) => void handleFileChange(event)}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] shadow-inset outline-none"
            />
          </label>

          {fileName && issues.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-control border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-3">
              <p className="text-sm font-medium text-[var(--color-danger-strong)]">Couldn't import "{fileName}":</p>
              <ul className="list-inside list-disc text-sm text-[var(--color-danger)]">
                {issues.map((issueItem, index) => (
                  <li key={index}>{issueItem.message}</li>
                ))}
              </ul>
            </div>
          )}

          {parsedPackage && (
            <div className="flex flex-col gap-1.5 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
              <p className="text-sm font-medium text-[var(--color-ink)]">{parsedPackage.node.title || 'Untitled node'}</p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {parsedPackage.node.nodeType === 'concept' ? 'Concept' : 'Entity'}
                {parsedPackage.node.description ? ` — ${parsedPackage.node.description}` : ''}
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
            <p className="text-sm text-[var(--color-danger)]">
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
                  { onSuccess: (result) => setImportResult(result) },
                )
              }}
            >
              Import
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
