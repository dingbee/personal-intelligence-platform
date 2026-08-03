import type { NoteWithDocument } from '@/modules/notes/api/notes'
import type { DocumentWithTags } from '@/modules/library/api/documents'
import type { Conversation, KnowledgeCollection, KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

/** Matches the Hub's UX-15.3 zone names exactly (Continue Working is ContinueWorkingCard's own concern — it's not produced here). */
export type IntelligenceZone = 'attention' | 'active' | 'organize' | 'shared' | 'learned'

export interface IntelligenceItem {
  id: string
  zone: IntelligenceZone
  title: string
  description: string
  href: string
  /** ISO timestamp — drives both display (formatRelativeTime) and cross-item sort order. */
  timestamp: string
  /** UX-15.4 Phase 5 — the specific action `href` performs (e.g. "Resume Conversation," "Open Collection") so the item exposes what clicking it does, not just that it links somewhere. */
  actionLabel: string
}

export interface ComputeWorkspaceIntelligenceInput {
  documents: DocumentWithTags[]
  notes: NoteWithDocument[]
  knowledgeNodes: KnowledgeNode[]
  /** All knowledge_links for the workspace — polymorphic, so this function itself filters by source_type/target_type per signal rather than assuming a pre-filtered shape. */
  edges: KnowledgeLink[]
  collections: KnowledgeCollection[]
  activeConversations: Conversation[]
  currentUserId: string
  now?: Date
}

const RECENT_IMPORT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const RAPID_COLLECTION_GROWTH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const RAPID_COLLECTION_GROWTH_MIN_NEW_MEMBERS = 3
const STALE_PINNED_CONVERSATION_MS = 7 * 24 * 60 * 60 * 1000
const FREQUENTLY_REFERENCED_MIN_COUNT = 3
const TOP_REFERENCED_NOTES_LIMIT = 3
const SHARED_ITEMS_LIMIT = 3

function readImportedAt(metadata: Record<string, unknown> | null): string | null {
  const importedFrom = metadata?.importedFrom as { importedAt?: string } | undefined
  return importedFrom?.importedAt ?? null
}

/**
 * UX-15.3 Phase 2 — every item here is derived entirely from data the
 * Hub already fetches (or one more call to an existing, already-used-
 * elsewhere API function — see hubData.ts). No AI generation, no new
 * table, no new backend computation: this is orchestration over
 * `documents`/`notes`/`knowledgeNodes`/`edges` (knowledge_links, already
 * fetched for the evolution snapshot)/`collections`/`activeConversations`,
 * grouped into the zones the discovery doc's Phase 3 recommends.
 *
 * "Recently Active" has no computation here by design — Hub's existing
 * `RecentNotesSection`/`ActiveConversationsSection` (UX-15.2) already
 * cover it directly from `recentNotes`/`activeConversations`, so
 * reproducing that here would be a second implementation of the same
 * list, exactly the thing UX-15.2 consolidated away.
 */
export function computeWorkspaceIntelligence(input: ComputeWorkspaceIntelligenceInput): IntelligenceItem[] {
  const now = input.now ?? new Date()
  const items: IntelligenceItem[] = []

  const unprocessedDocuments = input.documents.filter((d) => d.status !== 'ready')
  if (unprocessedDocuments.length > 0) {
    const hasFailure = unprocessedDocuments.some((d) => d.status === 'error')
    items.push({
      id: 'attention-documents-processing',
      zone: 'attention',
      title: `${unprocessedDocuments.length} document${unprocessedDocuments.length === 1 ? '' : 's'} awaiting processing`,
      description: hasFailure ? 'One or more documents failed processing.' : 'Still uploading or processing.',
      href: '/library',
      timestamp: unprocessedDocuments[0]!.created_at,
      actionLabel: 'Open Library',
    })
  }

  const nodeIds = new Set(input.knowledgeNodes.map((n) => n.id))
  const degrees = new Map<string, number>(input.knowledgeNodes.map((n) => [n.id, 0]))
  for (const edge of input.edges) {
    if (!edge.generated_by) continue
    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) continue
    degrees.set(edge.source_id, (degrees.get(edge.source_id) ?? 0) + 1)
    degrees.set(edge.target_id, (degrees.get(edge.target_id) ?? 0) + 1)
  }
  const unlinkedNodes = input.knowledgeNodes.filter((n) => (degrees.get(n.id) ?? 0) === 0)
  if (unlinkedNodes.length > 0) {
    items.push({
      id: 'attention-unlinked-nodes',
      zone: 'attention',
      title: `${unlinkedNodes.length} concept${unlinkedNodes.length === 1 ? '' : 's'} with no known connections`,
      description: unlinkedNodes
        .slice(0, 3)
        .map((n) => n.title)
        .join(', '),
      href: '/knowledge/graph',
      timestamp: unlinkedNodes[0]!.updated_at,
      actionLabel: 'View Graph',
    })
  }

  for (const conversation of input.activeConversations) {
    const isStale = now.getTime() - new Date(conversation.updated_at).getTime() > STALE_PINNED_CONVERSATION_MS
    if (!(conversation.is_pinned || conversation.favorite) || !isStale) continue
    items.push({
      id: `attention-followup-${conversation.id}`,
      zone: 'attention',
      title: `Follow up: "${conversation.title || 'Untitled conversation'}"`,
      description: "Pinned, but you haven't returned to it in a while.",
      href: `/chat?conversationId=${conversation.id}`,
      timestamp: conversation.updated_at,
      actionLabel: 'Resume Conversation',
    })
  }

  const collectionsById = new Map(input.collections.map((c) => [c.id, c]))
  const recentMemberCounts = new Map<string, number>()
  for (const edge of input.edges) {
    if (edge.source_type !== 'knowledge_collection') continue
    if (now.getTime() - new Date(edge.created_at).getTime() > RAPID_COLLECTION_GROWTH_WINDOW_MS) continue
    recentMemberCounts.set(edge.source_id, (recentMemberCounts.get(edge.source_id) ?? 0) + 1)
  }
  for (const [collectionId, count] of recentMemberCounts) {
    if (count < RAPID_COLLECTION_GROWTH_MIN_NEW_MEMBERS) continue
    const collection = collectionsById.get(collectionId)
    if (!collection) continue
    items.push({
      id: `organize-collection-growth-${collectionId}`,
      zone: 'organize',
      title: `"${collection.name}" is growing quickly`,
      description: `${count} new item${count === 1 ? '' : 's'} added in the last two weeks.`,
      href: '/knowledge',
      timestamp: collection.updated_at,
      actionLabel: 'Open Collection',
    })
  }

  const noteReferenceCounts = new Map<string, number>()
  for (const edge of input.edges) {
    if (edge.source_type === 'note') noteReferenceCounts.set(edge.source_id, (noteReferenceCounts.get(edge.source_id) ?? 0) + 1)
    if (edge.target_type === 'note') noteReferenceCounts.set(edge.target_id, (noteReferenceCounts.get(edge.target_id) ?? 0) + 1)
  }
  const notesById = new Map(input.notes.map((n) => [n.id, n]))
  const frequentlyReferenced = [...noteReferenceCounts.entries()]
    .filter(([, count]) => count >= FREQUENTLY_REFERENCED_MIN_COUNT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_REFERENCED_NOTES_LIMIT)
  for (const [noteId, count] of frequentlyReferenced) {
    const note = notesById.get(noteId)
    if (!note) continue
    items.push({
      id: `organize-frequently-referenced-${noteId}`,
      zone: 'organize',
      title: `"${note.title || 'Untitled note'}" is referenced often`,
      description: `Linked from ${count} other item${count === 1 ? '' : 's'} — worth adding to a collection.`,
      href: `/notes/${noteId}`,
      timestamp: note.updated_at,
      actionLabel: 'Open Note',
    })
  }

  const sharedItems = [
    ...input.notes
      .filter((n) => n.user_id !== input.currentUserId)
      .map((n) => ({ id: n.id, title: n.title || 'Untitled note', href: `/notes/${n.id}`, updatedAt: n.updated_at, kind: 'note' as const })),
    ...input.activeConversations
      .filter((c) => c.user_id !== input.currentUserId)
      .map((c) => ({
        id: c.id,
        title: c.title || 'Untitled conversation',
        href: `/chat?conversationId=${c.id}`,
        updatedAt: c.updated_at,
        kind: 'conversation' as const,
      })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  for (const shared of sharedItems.slice(0, SHARED_ITEMS_LIMIT)) {
    items.push({
      id: `shared-${shared.kind}-${shared.id}`,
      zone: 'shared',
      title: shared.title,
      description: `A teammate's ${shared.kind}, updated recently.`,
      href: shared.href,
      timestamp: shared.updatedAt,
      actionLabel: shared.kind === 'note' ? 'Open Note' : 'Resume Conversation',
    })
  }

  for (const note of input.notes) {
    const importedAt = readImportedAt(note.generation_metadata)
    if (!importedAt || now.getTime() - new Date(importedAt).getTime() > RECENT_IMPORT_WINDOW_MS) continue
    items.push({
      id: `learned-imported-note-${note.id}`,
      zone: 'learned',
      title: `Imported: "${note.title || 'Untitled note'}"`,
      description: 'Recently brought in from another account or workspace.',
      href: `/notes/${note.id}`,
      timestamp: importedAt,
      actionLabel: 'Open Note',
    })
  }
  for (const node of input.knowledgeNodes) {
    const importedAt = readImportedAt(node.generation_metadata)
    if (!importedAt || now.getTime() - new Date(importedAt).getTime() > RECENT_IMPORT_WINDOW_MS) continue
    items.push({
      id: `learned-imported-node-${node.id}`,
      zone: 'learned',
      title: `Imported concept: "${node.title}"`,
      description: 'Recently brought in from another account or workspace.',
      href: '/knowledge/explorer',
      timestamp: importedAt,
      actionLabel: 'View Concept',
    })
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
