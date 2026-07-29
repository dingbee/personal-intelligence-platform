import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

export interface Cluster {
  id: string
  /** The highest-degree node's title within the cluster — deterministic, no AI classification/labeling. */
  label: string
  nodeIds: string[]
  size: number
  /** edges present / edges possible among these nodes (0-1). */
  density: number
}

function buildAdjacency(nodes: KnowledgeNode[], edges: KnowledgeLink[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set<string>()]))
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (!edge.generated_by) continue
    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) continue
    adjacency.get(edge.source_id)?.add(edge.target_id)
    adjacency.get(edge.target_id)?.add(edge.source_id)
  }
  return adjacency
}

/**
 * UX-10 Phase 5 — connected components over the AI-generated relationship
 * graph. Clusters emerge purely from topology (BFS over edges); there is no
 * text similarity, embedding, or AI classification involved. A component of
 * size 1 (no edges to anything) is not a "cluster" — it shows up instead as
 * an isolated_concept insight.
 */
export function computeConceptClusters(nodes: KnowledgeNode[], edges: KnowledgeLink[]): Cluster[] {
  const adjacency = buildAdjacency(nodes, edges)
  const nodesById = new Map(nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()
  const clusters: Cluster[] = []

  for (const node of nodes) {
    if (visited.has(node.id)) continue
    const neighbors = adjacency.get(node.id)
    if (!neighbors || neighbors.size === 0) {
      visited.add(node.id)
      continue
    }

    const componentIds: string[] = []
    const queue = [node.id]
    visited.add(node.id)
    while (queue.length > 0) {
      const currentId = queue.shift()!
      componentIds.push(currentId)
      for (const neighborId of adjacency.get(currentId) ?? []) {
        if (visited.has(neighborId)) continue
        visited.add(neighborId)
        queue.push(neighborId)
      }
    }

    const componentNodes = componentIds.map((id) => nodesById.get(id)!).sort((a, b) => a.id.localeCompare(b.id))
    const edgeCount = componentIds.reduce((sum, id) => sum + (adjacency.get(id)?.size ?? 0), 0) / 2
    const possibleEdges = (componentIds.length * (componentIds.length - 1)) / 2
    const label = [...componentNodes].sort(
      (a, b) => (adjacency.get(b.id)?.size ?? 0) - (adjacency.get(a.id)?.size ?? 0),
    )[0]!.title

    clusters.push({
      id: componentNodes[0]!.id,
      label,
      nodeIds: componentIds,
      size: componentIds.length,
      density: possibleEdges > 0 ? edgeCount / possibleEdges : 0,
    })
  }

  return clusters.sort((a, b) => b.size - a.size)
}
