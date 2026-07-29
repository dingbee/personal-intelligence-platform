import { supabase } from '@/shared/lib/supabase'
import { listDocuments } from '@/modules/library/api/documents'
import { listNotes } from '@/modules/notes/api/notes'
import { listConversations } from '@/modules/ai/chat/api/conversations'
import { listMemories } from '@/modules/ai/memory/api/memory'
import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { listKnowledgeLinks } from '@/modules/knowledge-graph/api/graph'
import { listReadingProgressDetailsForWorkspace } from '@/modules/reader/api/readingProgress'
import { getWorkspace, getWorkspaceStats } from '@/modules/workspaces/api/workspaces'
import type { WorkspaceEvolutionSnapshot } from '@/modules/evolution/evolutionReport'

const LINKS_SAMPLE_LIMIT = 1000

/**
 * UX-13 — every knowledge_node_sources row for a set of nodes, including
 * created_at. listKnowledgeNodeSourcesForNodes (Phase 9C) already exposes
 * node/source ids but not the timestamp; conceptEvolution needs the
 * timestamp to tell *when* each source was added, so this is a sibling
 * query over the same table rather than widening that function's existing
 * return shape (which other callers already depend on).
 */
export async function listKnowledgeNodeSourceEventsForNodes(
  nodeIds: string[],
): Promise<{ nodeId: string; createdAt: string }[]> {
  if (nodeIds.length === 0) return []
  const { data, error } = await supabase.from('knowledge_node_sources').select('node_id, created_at').in('node_id', nodeIds)
  if (error) throw error
  return data.map((row) => ({ nodeId: row.node_id, createdAt: row.created_at }))
}

/**
 * UX-13 — the single fetch-and-compose entry point for one workspace's
 * evolution data, mirroring dashboardInteraction.ts's buildDashboardState.
 * Every fetch reuses an existing API function (or a small additive
 * sibling query added this phase, same house style as
 * listReadingProgressForWorkspace/listAllFlashcards in UX-11); the actual
 * evolution logic lives entirely in buildWorkspaceEvolutionReport (pure,
 * unit-tested) — this function only gathers its input.
 */
export async function getWorkspaceEvolutionSnapshot(workspaceId: string): Promise<WorkspaceEvolutionSnapshot> {
  const [workspace, documents, notes, concepts, edges, conversations, memories, readingProgress, stats] = await Promise.all([
    getWorkspace(workspaceId),
    listDocuments({ workspaceId }),
    listNotes({ workspaceId }),
    listKnowledgeNodes({ workspaceId }),
    listKnowledgeLinks(workspaceId, LINKS_SAMPLE_LIMIT),
    listConversations({ workspaceId }),
    listMemories({ workspaceId }),
    listReadingProgressDetailsForWorkspace(workspaceId),
    getWorkspaceStats(workspaceId),
  ])

  const sourceEvents = await listKnowledgeNodeSourceEventsForNodes(concepts.map((c) => c.id))

  const readDocumentIds = new Set(readingProgress.map((r) => r.documentId))

  return {
    workspaceId,
    workspaceCreatedAt: workspace.created_at,
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      created_at: d.created_at,
      updated_at: d.updated_at,
      status: d.status,
      hasReadingProgress: readDocumentIds.has(d.id),
    })),
    notes: notes.map((n) => ({ id: n.id, title: n.title, created_at: n.created_at })),
    concepts,
    edges,
    sourceEvents,
    conversations: conversations.map((c) => ({ created_at: c.created_at })),
    memories,
    readingProgressTimestamps: readingProgress.map((r) => r.updatedAt),
    lastActivityAt: stats.lastActivityAt,
  }
}
