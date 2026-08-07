import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

export interface KnowledgeNodeSourceRef {
  nodeId: string
  sourceType: string
  sourceId: string
}

export interface RelationshipStrength {
  nodeAId: string
  nodeBId: string
  /** 0-1. Combines direct-edge confidence with how many sources the two nodes share — never AI-scored, purely arithmetic over already-extracted data. */
  score: number
  hasDirectEdge: boolean
  edgeConfidence: number | null
  relationshipType: string | null
  sharedSourceCount: number
}

const DIRECT_EDGE_BASE = 0.5
const SHARED_SOURCE_UNIT = 0.15
const MAX_SHARED_SOURCE_CONTRIBUTION = 0.5

/** Only AI-generated edges (generated_by set) count as "direct" — user-authored knowledge_links (note<->highlight) are a different graph, not concept relationships. */
function findDirectEdge(nodeAId: string, nodeBId: string, edges: KnowledgeLink[]): KnowledgeLink | null {
  return (
    edges.find(
      (edge) =>
        Boolean(edge.generated_by) &&
        ((edge.source_id === nodeAId && edge.target_id === nodeBId) ||
          (edge.source_id === nodeBId && edge.target_id === nodeAId)),
    ) ?? null
  )
}

function countSharedSources(nodeAId: string, nodeBId: string, nodeSources: KnowledgeNodeSourceRef[]): number {
  const aSourceIds = new Set(
    nodeSources.filter((s) => s.nodeId === nodeAId && s.sourceType === 'document').map((s) => s.sourceId),
  )
  const bSourceIds = nodeSources.filter((s) => s.nodeId === nodeBId && s.sourceType === 'document').map((s) => s.sourceId)
  return bSourceIds.filter((id) => aSourceIds.has(id)).length
}

/** Pure scoring — no I/O. Reused by graphExplorer (connection strength) and conceptClusters (weighting, if ever needed). */
export function scoreRelationship(
  nodeAId: string,
  nodeBId: string,
  edges: KnowledgeLink[],
  nodeSources: KnowledgeNodeSourceRef[],
): RelationshipStrength {
  const directEdge = findDirectEdge(nodeAId, nodeBId, edges)
  const sharedSourceCount = countSharedSources(nodeAId, nodeBId, nodeSources)

  let score = 0
  if (directEdge) {
    score += DIRECT_EDGE_BASE + (directEdge.confidence ?? 0.5) * DIRECT_EDGE_BASE
  }
  score += Math.min(sharedSourceCount * SHARED_SOURCE_UNIT, MAX_SHARED_SOURCE_CONTRIBUTION)

  return {
    nodeAId,
    nodeBId,
    score: Math.min(score, 1),
    hasDirectEdge: Boolean(directEdge),
    edgeConfidence: directEdge?.confidence ?? null,
    relationshipType: directEdge?.relationship_type ?? null,
    sharedSourceCount,
  }
}

/** Every AI-generated edge in the map, scored — the basis for "strongest relationships" surfaced in the Graph Workspace. Bounded by the edge list itself (already small, see retrieveGraphContext's MAX_RELATIONSHIPS precedent), no combinatorial blow-up. */
export function computeRelationshipStrengths(
  nodes: KnowledgeNode[],
  edges: KnowledgeLink[],
  nodeSources: KnowledgeNodeSourceRef[],
): RelationshipStrength[] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const aiEdges = edges.filter(
    (edge) => Boolean(edge.generated_by) && nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id),
  )
  return aiEdges
    .map((edge) => scoreRelationship(edge.source_id, edge.target_id, edges, nodeSources))
    .sort((a, b) => b.score - a.score)
}

/**
 * Knowledge Intelligence Layer v1, Feature 3 — the `{relationship,
 * evidenceCount, sources}` shape the milestone asks every relationship to
 * carry. Deliberately not a new scoring formula: `relationship` is the
 * edge's own already-persisted `confidence` (the model's self-estimate at
 * creation time, same value `scoreRelationship` reads), and
 * evidence/sources come from `knowledge_node_sources` — but unlike
 * `countSharedSources` above (document-only, by design, for the coarser
 * strength score), this counts a shared source of ANY type, since "this
 * relationship is corroborated by a document AND a conversation" is
 * exactly what Feature 3's own example asks to show. Never fabricates a
 * number where the edge has none: `relationship` stays null if the model
 * never reported a confidence for this edge.
 */
export interface RelationshipConfidence {
  relationship: number | null
  evidenceCount: number
  sources: string[]
}

export function computeRelationshipConfidence(
  nodeAId: string,
  nodeBId: string,
  edge: KnowledgeLink | null,
  nodeSources: KnowledgeNodeSourceRef[],
): RelationshipConfidence {
  const aSourceKeys = new Set(
    nodeSources.filter((s) => s.nodeId === nodeAId).map((s) => `${s.sourceType}:${s.sourceId}`),
  )
  const sharedKeys = nodeSources
    .filter((s) => s.nodeId === nodeBId)
    .map((s) => `${s.sourceType}:${s.sourceId}`)
    .filter((key) => aSourceKeys.has(key))

  const distinctShared = new Set(sharedKeys)
  const sources = Array.from(new Set(Array.from(distinctShared).map((key) => key.split(':')[0]!))).sort()

  return {
    relationship: edge?.confidence ?? null,
    evidenceCount: distinctShared.size,
    sources,
  }
}
