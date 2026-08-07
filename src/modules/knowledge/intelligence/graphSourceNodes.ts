import type { GraphEdge, GraphNode, GraphNodeType, KnowledgeGraphData } from '@/modules/knowledge-graph/api/types'

/**
 * Knowledge Intelligence Layer v1, Feature 1 — the "Concepts → Documents →
 * Images → Conversations → Notes" chain the milestone asks for. Rather
 * than merging the AI Knowledge Graph with the separate, differently-shaped
 * Content Connections graph (see the discovery doc's "what this milestone
 * does not build"), this adds one more layer onto the existing concept
 * graph: each concept/entity node's own evidence (`knowledge_node_sources`)
 * rendered as extra leaf nodes, via the same GraphCanvas/GraphNode/GraphEdge
 * shapes it already renders — no new renderer, no new graph model.
 */
const KNOWN_SOURCE_TYPES: ReadonlySet<string> = new Set(['document', 'note', 'asset', 'conversation'])

export interface ConceptSourceRef {
  /** The concept/entity node this source is evidence for. */
  conceptNodeId: string
  sourceType: string
  sourceId: string
  /** Null when the source's title couldn't be resolved (e.g. deleted) — dropped, same convention as resolveSourceItems. */
  title: string | null
}

/**
 * Pure: turns resolved evidence references into graph nodes/edges. A
 * source referenced by multiple concepts becomes one node with multiple
 * edges, not a duplicate node per concept. Unknown/unresolved source types
 * are silently dropped rather than rendered with a broken label.
 */
export function buildSourceGraphAdditions(sources: ConceptSourceRef[]): KnowledgeGraphData {
  const nodesById = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  for (const source of sources) {
    if (!source.title || !KNOWN_SOURCE_TYPES.has(source.sourceType)) continue
    if (!nodesById.has(source.sourceId)) {
      nodesById.set(source.sourceId, { id: source.sourceId, type: source.sourceType as GraphNodeType, label: source.title })
    }
    edges.push({
      id: `evidence-${source.conceptNodeId}-${source.sourceType}-${source.sourceId}`,
      sourceId: source.conceptNodeId,
      targetId: source.sourceId,
      relationshipLabel: 'evidenced_by',
    })
  }

  return { nodes: Array.from(nodesById.values()), edges }
}

/** Concatenates two graph layers — the existing concept graph plus the source additions above. Plain concat: node ids come from different tables (concepts vs. documents/notes/assets/conversations), so cross-layer id collisions aren't a real concern here. */
export function mergeGraphLayers(base: KnowledgeGraphData, additions: KnowledgeGraphData): KnowledgeGraphData {
  return { nodes: [...base.nodes, ...additions.nodes], edges: [...base.edges, ...additions.edges] }
}
