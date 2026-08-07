import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { listKnowledgeNodes, listKnowledgeNodeSourcesForNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { listKnowledgeLinks } from '@/modules/knowledge-graph/api/graph'
import { fetchTitlesByIds } from '@/modules/knowledge-intelligence/api/sourceResolution'
import type { ConceptSourceRef } from '@/modules/knowledge/intelligence/graphSourceNodes'

export interface KnowledgeMap {
  nodes: KnowledgeNode[]
  edges: KnowledgeLink[]
}

/**
 * Composes AI-generated nodes with the AI-generated edges between them —
 * data only, no layout or rendering (that's Phase 7B+). Reuses Phase 6C's
 * listKnowledgeLinks rather than querying knowledge_links a second way.
 */
export async function generateKnowledgeMap(workspaceId: string | null): Promise<KnowledgeMap> {
  const [nodes, links] = await Promise.all([listKnowledgeNodes({ workspaceId }), listKnowledgeLinks(workspaceId)])

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = links.filter(
    (link) => link.source_type === 'knowledge_node' && link.target_type === 'knowledge_node' && nodeIds.has(link.source_id) && nodeIds.has(link.target_id),
  )

  return { nodes, edges }
}

/**
 * Knowledge Intelligence Layer v1, Feature 1 — the evidence-resolution half
 * of "Show sources": fetches `knowledge_node_sources` for the given concept
 * nodes and resolves each source's title, per source type. Reuses
 * `listKnowledgeNodeSourcesForNodes` and `fetchTitlesByIds` exactly as
 * `getKnowledgeNodeEvidence` already does for a single node — this is the
 * same resolution, batched across a whole graph instead of one node.
 * Returns `ConceptSourceRef[]` for `buildSourceGraphAdditions` to turn into
 * graph nodes/edges; does no rendering itself.
 */
export async function getConceptSourceNodes(nodeIds: string[]): Promise<ConceptSourceRef[]> {
  if (nodeIds.length === 0) return []
  const sources = await listKnowledgeNodeSourcesForNodes(nodeIds)
  if (sources.length === 0) return []

  const idsByType = new Map<string, string[]>()
  for (const source of sources) {
    const list = idsByType.get(source.sourceType) ?? []
    list.push(source.sourceId)
    idsByType.set(source.sourceType, list)
  }

  const tableByType: Record<string, string> = { document: 'documents', note: 'notes', asset: 'assets', conversation: 'conversations' }
  const titleById = new Map<string, string>()
  await Promise.all(
    Array.from(idsByType.entries()).map(async ([sourceType, ids]) => {
      const table = tableByType[sourceType]
      if (!table) return
      const rows = await fetchTitlesByIds(table, ids)
      for (const row of rows) titleById.set(`${sourceType}:${row.id}`, row.title)
    }),
  )

  return sources.map((source) => ({
    conceptNodeId: source.nodeId,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: titleById.get(`${source.sourceType}:${source.sourceId}`) ?? null,
  }))
}
