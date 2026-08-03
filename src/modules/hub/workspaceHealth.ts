import type { NoteWithDocument } from '@/modules/notes/api/notes'
import type { DocumentWithTags } from '@/modules/library/api/documents'
import type { KnowledgeCollection, KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

export type WorkspaceHealthStatus = 'good' | 'warning' | 'unknown'

export interface WorkspaceHealthIndicator {
  id: string
  label: string
  value: string
  status: WorkspaceHealthStatus
  description: string
}

export interface ComputeWorkspaceHealthInput {
  documents: DocumentWithTags[]
  notes: NoteWithDocument[]
  /** Note ids that have at least one tag — from noteTags.ts's listTaggedNoteIds bulk lookup. */
  taggedNoteIds: Set<string>
  knowledgeNodes: KnowledgeNode[]
  edges: KnowledgeLink[]
  collections: KnowledgeCollection[]
  readDocumentCount: number
  totalReadyDocumentCount: number
  now?: Date
}

const RECENT_IMPORT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const CONNECTEDNESS_WARNING_THRESHOLD = 0.5

function statusFromRatio(ratio: number, goodAt: number): WorkspaceHealthStatus {
  return ratio >= goodAt ? 'good' : 'warning'
}

function readImportedAt(metadata: Record<string, unknown> | null): string | null {
  const importedFrom = metadata?.importedFrom as { importedAt?: string } | undefined
  return importedFrom?.importedAt ?? null
}

/**
 * UX-15.3 Phase 5 — every indicator reuses data already fetched for
 * `WorkspaceHubState`/`computeWorkspaceIntelligence`, plus one small new
 * bulk query (`listTaggedNoteIds`, mirroring `listKnowledgeNodeSourcesForNodes`'s
 * own pattern) for the untagged-notes count. "Recent backup/export
 * status" has no backing signal at all (see the discovery doc §5) — it's
 * rendered as an explicit 'unknown' indicator rather than invented from
 * an unrelated proxy.
 */
export function computeWorkspaceHealth(input: ComputeWorkspaceHealthInput): WorkspaceHealthIndicator[] {
  const now = input.now ?? new Date()
  const indicators: WorkspaceHealthIndicator[] = []

  const nodeIds = new Set(input.knowledgeNodes.map((n) => n.id))
  const connectedIds = new Set<string>()
  for (const edge of input.edges) {
    if (!edge.generated_by) continue
    if (nodeIds.has(edge.source_id)) connectedIds.add(edge.source_id)
    if (nodeIds.has(edge.target_id)) connectedIds.add(edge.target_id)
  }
  const connectivityRatio = input.knowledgeNodes.length === 0 ? 1 : connectedIds.size / input.knowledgeNodes.length
  indicators.push({
    id: 'knowledge-connectedness',
    label: 'Knowledge connectedness',
    value: input.knowledgeNodes.length === 0 ? 'No concepts yet' : `${connectedIds.size} / ${input.knowledgeNodes.length}`,
    status: input.knowledgeNodes.length === 0 ? 'unknown' : statusFromRatio(connectivityRatio, CONNECTEDNESS_WARNING_THRESHOLD),
    description: input.knowledgeNodes.length === 0 ? 'No concepts extracted yet.' : `${connectedIds.size} of ${input.knowledgeNodes.length} concepts are connected to at least one other.`,
  })

  const untaggedCount = input.notes.filter((n) => !input.taggedNoteIds.has(n.id)).length
  indicators.push({
    id: 'untagged-notes',
    label: 'Untagged notes',
    value: input.notes.length === 0 ? 'No notes yet' : `${untaggedCount} / ${input.notes.length}`,
    status: input.notes.length === 0 ? 'unknown' : untaggedCount === 0 ? 'good' : 'warning',
    description: input.notes.length === 0 ? 'No notes yet.' : `${untaggedCount} of ${input.notes.length} notes have no tag.`,
  })

  const orphanedDocuments = input.documents.filter((d) => d.collection_id === null && d.tags.length === 0)
  indicators.push({
    id: 'orphaned-documents',
    label: 'Orphaned documents',
    value: input.documents.length === 0 ? 'No documents yet' : `${orphanedDocuments.length} / ${input.documents.length}`,
    status: input.documents.length === 0 ? 'unknown' : orphanedDocuments.length === 0 ? 'good' : 'warning',
    description: input.documents.length === 0 ? 'No documents yet.' : `${orphanedDocuments.length} of ${input.documents.length} documents have no collection or tag.`,
  })

  const collectionMemberCounts = new Map<string, number>()
  for (const edge of input.edges) {
    if (edge.source_type !== 'knowledge_collection') continue
    collectionMemberCounts.set(edge.source_id, (collectionMemberCounts.get(edge.source_id) ?? 0) + 1)
  }
  const emptyCollections = input.collections.filter((c) => (collectionMemberCounts.get(c.id) ?? 0) === 0)
  indicators.push({
    id: 'empty-collections',
    label: 'Collections without members',
    value: input.collections.length === 0 ? 'No collections yet' : `${emptyCollections.length} / ${input.collections.length}`,
    status: input.collections.length === 0 ? 'unknown' : emptyCollections.length === 0 ? 'good' : 'warning',
    description: input.collections.length === 0 ? 'No collections yet.' : `${emptyCollections.length} of ${input.collections.length} collections have no members yet.`,
  })

  indicators.push({
    id: 'reading-progress',
    label: 'Reading progress',
    value: input.totalReadyDocumentCount === 0 ? 'No documents ready' : `${input.readDocumentCount} / ${input.totalReadyDocumentCount}`,
    status: input.totalReadyDocumentCount === 0 ? 'unknown' : statusFromRatio(input.readDocumentCount / input.totalReadyDocumentCount, CONNECTEDNESS_WARNING_THRESHOLD),
    description: input.totalReadyDocumentCount === 0 ? 'No documents ready to read yet.' : `${input.readDocumentCount} of ${input.totalReadyDocumentCount} ready documents have reading progress.`,
  })

  const recentImportCount =
    input.notes.filter((n) => {
      const importedAt = readImportedAt(n.generation_metadata)
      return importedAt && now.getTime() - new Date(importedAt).getTime() <= RECENT_IMPORT_WINDOW_MS
    }).length +
    input.knowledgeNodes.filter((n) => {
      const importedAt = readImportedAt(n.generation_metadata)
      return importedAt && now.getTime() - new Date(importedAt).getTime() <= RECENT_IMPORT_WINDOW_MS
    }).length
  indicators.push({
    id: 'recent-imports',
    label: 'Recent imports',
    value: `${recentImportCount}`,
    status: 'good',
    description: recentImportCount === 0 ? 'No notes or concepts imported in the last 30 days.' : `${recentImportCount} note${recentImportCount === 1 ? '' : 's'}/concept${recentImportCount === 1 ? '' : 's'} imported in the last 30 days.`,
  })

  const readyCount = input.documents.filter((d) => d.status === 'ready').length
  indicators.push({
    id: 'ai-indexing-progress',
    label: 'AI indexing progress',
    value: input.documents.length === 0 ? 'No documents yet' : `${readyCount} / ${input.documents.length}`,
    status: input.documents.length === 0 ? 'unknown' : statusFromRatio(readyCount / input.documents.length, CONNECTEDNESS_WARNING_THRESHOLD),
    description: input.documents.length === 0 ? 'No documents uploaded yet.' : `${readyCount} of ${input.documents.length} documents are fully indexed.`,
  })

  indicators.push({
    id: 'export-backup-status',
    label: 'Recent backup / export status',
    value: 'Not tracked',
    status: 'unknown',
    description: 'Export activity is not recorded anywhere yet, so this cannot be measured from existing data.',
  })

  return indicators
}
