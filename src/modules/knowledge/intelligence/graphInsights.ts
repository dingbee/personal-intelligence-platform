import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import type { KnowledgeNodeSourceRef } from '@/modules/knowledge/intelligence/relationshipStrength'

export type GraphInsightType =
  | 'most_connected_concept'
  | 'fastest_growing_topic'
  | 'isolated_concept'
  | 'weakly_connected_concept'
  | 'recently_expanded_knowledge'
  | 'frequently_referenced_concept'
  | 'cross_workspace_concept'

export interface GraphInsight {
  type: GraphInsightType
  label: string
  value: string
  nodeId: string
}

const RECENT_GROWTH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export interface DocumentRef {
  id: string
  title: string
  workspace_id: string | null
}

export interface ComputeGraphInsightsInput {
  nodes: KnowledgeNode[]
  edges: KnowledgeLink[]
  nodeSources: KnowledgeNodeSourceRef[]
  documents: DocumentRef[]
  /** Injected for deterministic tests; defaults to the real clock. */
  now?: Date
}

function countDegrees(nodes: KnowledgeNode[], edges: KnowledgeLink[]): Map<string, number> {
  const degrees = new Map<string, number>(nodes.map((n) => [n.id, 0]))
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (!edge.generated_by) continue
    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) continue
    degrees.set(edge.source_id, (degrees.get(edge.source_id) ?? 0) + 1)
    degrees.set(edge.target_id, (degrees.get(edge.target_id) ?? 0) + 1)
  }
  return degrees
}

function countSourcesPerNode(nodeSources: KnowledgeNodeSourceRef[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const source of nodeSources) {
    if (source.sourceType !== 'document') continue
    counts.set(source.nodeId, (counts.get(source.nodeId) ?? 0) + 1)
  }
  return counts
}

/**
 * UX-10 Phase 3 — pure graph analysis, no AI. Every insight is derived from
 * knowledge_nodes/knowledge_links/knowledge_node_sources shape already
 * produced by extraction (Phase 7A-9C) — nothing here recomputes or
 * re-extracts anything. An insight is omitted (not padded with a
 * placeholder) whenever the underlying data can't support it, e.g. no
 * cross_workspace_concept when every node's sources sit in one workspace.
 */
export function computeGraphInsights(input: ComputeGraphInsightsInput): GraphInsight[] {
  const { nodes, edges, nodeSources, documents } = input
  const now = input.now ?? new Date()
  if (nodes.length === 0) return []

  const insights: GraphInsight[] = []
  const degrees = countDegrees(nodes, edges)
  const sourceCounts = countSourcesPerNode(nodeSources)
  const documentWorkspaceById = new Map(documents.map((d) => [d.id, d.workspace_id]))

  const mostConnected = [...nodes].sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))[0]
  if (mostConnected && (degrees.get(mostConnected.id) ?? 0) > 0) {
    insights.push({
      type: 'most_connected_concept',
      label: 'Most connected concept',
      value: `${mostConnected.title} (${degrees.get(mostConnected.id)} connections)`,
      nodeId: mostConnected.id,
    })
  }

  // Growth is measured on knowledge_nodes.created_at/updated_at proximity to
  // `now` combined with source count — the closest proxy available without
  // a persisted history of node mutations (see Phase 11 audit note).
  const growthCandidates = nodes
    .map((node) => ({
      node,
      recentSourceCount: nodeSources.filter(
        (s) => s.nodeId === node.id && s.sourceType === 'document',
      ).length,
      isRecent: now.getTime() - new Date(node.updated_at).getTime() <= RECENT_GROWTH_WINDOW_MS,
    }))
    .filter((c) => c.isRecent && c.recentSourceCount > 0)
    .sort((a, b) => b.recentSourceCount - a.recentSourceCount)
  if (growthCandidates.length > 0 && growthCandidates[0]!.recentSourceCount > 1) {
    const winner = growthCandidates[0]!
    insights.push({
      type: 'fastest_growing_topic',
      label: 'Fastest growing topic',
      value: `${winner.node.title} (${winner.recentSourceCount} sources in the last 14 days)`,
      nodeId: winner.node.id,
    })
  }

  const isolated = nodes.find((n) => (degrees.get(n.id) ?? 0) === 0)
  if (isolated) {
    insights.push({
      type: 'isolated_concept',
      label: 'Isolated concept',
      value: `${isolated.title} has no known connections yet`,
      nodeId: isolated.id,
    })
  }

  const weaklyConnected = nodes.find((n) => (degrees.get(n.id) ?? 0) === 1)
  if (weaklyConnected) {
    insights.push({
      type: 'weakly_connected_concept',
      label: 'Weakly connected concept',
      value: `${weaklyConnected.title} has only one connection`,
      nodeId: weaklyConnected.id,
    })
  }

  const mostRecent = [...nodes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0]
  if (mostRecent) {
    insights.push({
      type: 'recently_expanded_knowledge',
      label: 'Recently expanded knowledge',
      value: `${mostRecent.title} was added most recently`,
      nodeId: mostRecent.id,
    })
  }

  const mostReferenced = [...nodes].sort((a, b) => (sourceCounts.get(b.id) ?? 0) - (sourceCounts.get(a.id) ?? 0))[0]
  if (mostReferenced && (sourceCounts.get(mostReferenced.id) ?? 0) > 1) {
    insights.push({
      type: 'frequently_referenced_concept',
      label: 'Frequently referenced concept',
      value: `${mostReferenced.title} appears in ${sourceCounts.get(mostReferenced.id)} documents`,
      nodeId: mostReferenced.id,
    })
  }

  const crossWorkspace = nodes.find((node) => {
    const docIds = nodeSources.filter((s) => s.nodeId === node.id && s.sourceType === 'document').map((s) => s.sourceId)
    const workspaceIds = new Set(docIds.map((id) => documentWorkspaceById.get(id) ?? null))
    return workspaceIds.size > 1
  })
  if (crossWorkspace) {
    insights.push({
      type: 'cross_workspace_concept',
      label: 'Concept spanning workspaces',
      value: `${crossWorkspace.title} appears across multiple workspaces`,
      nodeId: crossWorkspace.id,
    })
  }

  return insights
}
