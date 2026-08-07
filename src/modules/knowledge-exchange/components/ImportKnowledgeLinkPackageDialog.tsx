import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useImportKnowledgeLinkPackage } from '@/modules/knowledge-exchange/hooks/useImportKnowledgeLinkPackage'
import { parseKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/validateKnowledgeLinkPackage'
import type { KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'
import type { ImportKnowledgeLinkPackageResult } from '@/modules/knowledge-exchange/knowledge-links/importKnowledgeLinkPackage'
import type { PackageValidationIssue } from '@/modules/knowledge-exchange/packages/PackageValidator'
import { Button } from '@/shared/components/ui/Button'
import { Dialog } from '@/shared/components/ui/Dialog'

export interface ImportKnowledgeLinkPackageDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * UX-14.5.10.4 — file picker → validation summary → workspace selector →
 * success summary, the exact same `<dialog>` shell every prior Import
 * dialog already established. Like Knowledge Node import, the success
 * screen distinguishes "created" from "matched an existing concept" —
 * here for *each* endpoint independently, since a relationship can (and
 * often will) connect one brand-new concept to one the importer already
 * has.
 */
export function ImportKnowledgeLinkPackageDialog({ open, onClose }: ImportKnowledgeLinkPackageDialogProps) {
  const { workspaces, currentWorkspaceId } = useWorkspace()
  const importPackage = useImportKnowledgeLinkPackage()

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedPackage, setParsedPackage] = useState<KnowledgeLinkPackage | null>(null)
  const [issues, setIssues] = useState<PackageValidationIssue[]>([])
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(currentWorkspaceId)
  const [importResult, setImportResult] = useState<ImportKnowledgeLinkPackageResult | null>(null)

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
    const result = parseKnowledgeLinkPackage(text)
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
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Relationship imported</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {importResult.relationshipType.replace(/_/g, ' ')}: "{importResult.sourceNode.title}" →{' '}
            "{importResult.targetNode.title}"
          </p>
          <ul className="list-inside list-disc text-sm text-[var(--color-ink-muted)]">
            <li>
              "{importResult.sourceNode.title}" was {importResult.sourceCreated ? 'imported as a new concept' : 'matched to one you already have'}
            </li>
            <li>
              "{importResult.targetNode.title}" was {importResult.targetCreated ? 'imported as a new concept' : 'matched to one you already have'}
            </li>
          </ul>
          <div className="flex justify-end gap-2">
            <Link to={`/knowledge/nodes/${importResult.sourceNode.id}`} className="text-sm text-[var(--color-accent)] hover:underline">
              View "{importResult.sourceNode.title}" →
            </Link>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Import a knowledge link package</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Choose a <code>.json</code> file exported from a relationship's Export button. Each endpoint becomes a
            brand-new concept in your account, or is matched to one you already have with the same title — it never
            overwrites an existing concept's content, and never creates a relationship without both endpoints
            resolved first.
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
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {parsedPackage.link.source.title} — {parsedPackage.link.relationshipType.replace(/_/g, ' ')} →{' '}
                {parsedPackage.link.target.title}
              </p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {parsedPackage.link.source.nodeType === 'concept' ? 'Concept' : 'Entity'} → {parsedPackage.link.target.nodeType === 'concept' ? 'concept' : 'entity'}
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
