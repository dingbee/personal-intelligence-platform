import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useImportKnowledgeCollectionPackage } from '@/modules/knowledge-exchange/hooks/useImportKnowledgeCollectionPackage'
import { parseKnowledgeCollectionPackageZip } from '@/modules/knowledge-exchange/knowledge-collections/validateKnowledgeCollectionPackage'
import type { ValidatedCollectionPackage } from '@/modules/knowledge-exchange/knowledge-collections/validateKnowledgeCollectionPackage'
import type { CollectionMemberEntry, CollectionMemberType } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'
import type { ImportKnowledgeCollectionPackageResult, CollectionMemberImportOutcome } from '@/modules/knowledge-exchange/knowledge-collections/importKnowledgeCollectionPackage'
import type { PackageValidationIssue } from '@/modules/knowledge-exchange/packages/PackageValidator'
import { Button } from '@/shared/components/ui/Button'

export interface ImportKnowledgeCollectionPackageDialogProps {
  open: boolean
  onClose: () => void
}

const MEMBER_TYPE_LABEL: Record<CollectionMemberType, string> = {
  document: 'Documents',
  note: 'Notes',
  conversation: 'Conversations',
  asset: 'Images',
  knowledge_node: 'Concepts',
}

function groupMembersByType(members: CollectionMemberEntry[]): [CollectionMemberType, number][] {
  const counts = new Map<CollectionMemberType, number>()
  for (const member of members) counts.set(member.memberType, (counts.get(member.memberType) ?? 0) + 1)
  return Array.from(counts.entries())
}

function groupOutcomesByType(outcomes: CollectionMemberImportOutcome[]): [CollectionMemberType, CollectionMemberImportOutcome[]][] {
  const groups = new Map<CollectionMemberType, CollectionMemberImportOutcome[]>()
  for (const outcome of outcomes) {
    const list = groups.get(outcome.memberType) ?? []
    list.push(outcome)
    groups.set(outcome.memberType, list)
  }
  return Array.from(groups.entries())
}

/**
 * UX-14.5.10.6 — file picker → validation summary → workspace selector →
 * success summary, the same `<dialog>` shell every prior Import dialog
 * already established, extended for a collection's multi-member nature
 * per the discovery's §7. The file picker accepts `.zip` and
 * `handleFileChange` awaits `parseKnowledgeCollectionPackageZip`, the same
 * async-zip shape `ImportDocumentPackageDialog` already established.
 *
 * The validation summary shows every member grouped by type (mirroring
 * `KnowledgeCollectionDetailPage`'s own type-grouped display). The success
 * screen reports each member's real outcome (imported/failed) grouped
 * the same way, plus every relationship's own outcome, so a partial
 * import is always a clear, explicit report — never a silently-absorbed
 * failure. Conversation members import through their own unmodified
 * `importConversationPackage` (UX-14.5.12), same as every other member
 * type — there is no longer an unsupported/skipped category.
 */
export function ImportKnowledgeCollectionPackageDialog({ open, onClose }: ImportKnowledgeCollectionPackageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { workspaces, currentWorkspaceId } = useWorkspace()
  const importPackage = useImportKnowledgeCollectionPackage()

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedPackage, setParsedPackage] = useState<ValidatedCollectionPackage | null>(null)
  const [issues, setIssues] = useState<PackageValidationIssue[]>([])
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(currentWorkspaceId)
  const [importResult, setImportResult] = useState<ImportKnowledgeCollectionPackageResult | null>(null)

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

    const result = await parseKnowledgeCollectionPackageZip(file)
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
      {importResult ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">"{importResult.collection.name}" imported</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {importResult.members.filter((m) => m.outcome === 'imported').length} of {importResult.members.length} members imported.
          </p>

          <div className="flex flex-col gap-3">
            {groupOutcomesByType(importResult.members).map(([type, outcomes]) => (
              <div key={type} className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
                <p className="text-sm font-medium text-[var(--color-ink)]">{MEMBER_TYPE_LABEL[type]}</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
                  {outcomes.map((outcome, index) => (
                    <li key={index}>
                      "{outcome.title}" —{' '}
                      {outcome.outcome === 'imported'
                        ? outcome.matched === true
                          ? 'matched to a concept you already have'
                          : outcome.matched === false
                            ? 'imported as new'
                            : 'imported'
                        : outcome.outcome === 'skipped'
                          ? 'skipped'
                          : `failed — ${outcome.error}`}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {importResult.relationships.length > 0 && (
            <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
              <p className="text-sm font-medium text-[var(--color-ink)]">Relationships</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
                {importResult.relationships.map((relationship, index) => (
                  <li key={index}>
                    {relationship.relationshipType.replace(/_/g, ' ')}: "{relationship.sourceTitle}" → "{relationship.targetTitle}" —{' '}
                    {relationship.outcome === 'imported' ? 'imported' : `failed — ${relationship.error}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Link to={`/knowledge/collections/${importResult.collection.id}`} className="text-sm text-[var(--color-accent)] hover:underline">
              View collection →
            </Link>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Import a collection package</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Choose a <code>.nova</code> (or older <code>.zip</code>) file exported from a collection's Save As
            dialog. It becomes a brand-new collection in your account — each member is imported independently, so one
            member failing never blocks the rest.
          </p>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Package file</span>
            <input
              type="file"
              accept="application/zip,.zip,.nova"
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
              <p className="text-sm font-medium text-[var(--color-ink)]">{parsedPackage.manifest.collection.name}</p>
              {parsedPackage.manifest.collection.description && (
                <p className="text-xs text-[var(--color-ink-muted)]">{parsedPackage.manifest.collection.description}</p>
              )}
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
                {groupMembersByType(parsedPackage.manifest.collection.members).map(([type, count]) => (
                  <li key={type}>
                    {count} {MEMBER_TYPE_LABEL[type]}
                  </li>
                ))}
              </ul>
              {parsedPackage.manifest.collection.relationships.length > 0 && (
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {parsedPackage.manifest.collection.relationships.length} relationship
                  {parsedPackage.manifest.collection.relationships.length === 1 ? '' : 's'} between concepts
                </p>
              )}
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
                  { onSuccess: (result) => setImportResult(result) },
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
