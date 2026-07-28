import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { listKnowledgeLinks } from '@/modules/knowledge-graph/api/graph'

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
