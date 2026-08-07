/**
 * 'concept'/'entity' added in UX-10 Phase 10 — GraphCanvas now also renders
 * the AI concept graph (knowledge_nodes/knowledge_links), not just the
 * document/note/highlight/tag graph it was built for in Phase 6C.
 * 'asset'/'conversation' added in Knowledge Intelligence Layer v1 —
 * `knowledge_node_sources.source_type` has recorded both since Multimodal
 * Intelligence v1, but no graph could render either as a node until now.
 */
export type GraphNodeType = 'document' | 'note' | 'highlight' | 'tag' | 'concept' | 'entity' | 'asset' | 'conversation'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  /** Only set for highlight nodes — needed to navigate to the reader, since a highlight's own id isn't a route. */
  documentId?: string
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  /**
   * Display label only — knowledge_links has no relationship_type column
   * (confirmed in the Phase 6C schema audit), so this is derived from the
   * source/target type pair rather than read from stored data. The only
   * edge-creation path in the app today is note→highlight
   * (linkNoteToHighlight, from the Notes Intelligence phase); other pairs
   * fall back to a generic label.
   */
  relationshipLabel: string
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
