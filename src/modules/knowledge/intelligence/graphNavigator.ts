import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import type { GraphEdge, GraphNode, KnowledgeGraphData } from '@/modules/knowledge-graph/api/types'

/**
 * UX-10 Phase 10 — adapts the AI concept/entity graph into the exact shape
 * GraphCanvas (built in Phase 6C for document/note/highlight/tag) already
 * renders. No new graph library, no new renderer: this is the only piece
 * that's new, and it's a pure data mapping. `visibleNodeIds` (from
 * computeVisibleNodeIds) narrows which nodes/edges are actually included,
 * so the same adapter serves both "show everything" and a focused
 * neighborhood view.
 */
export function toGraphData(nodes: KnowledgeNode[], edges: KnowledgeLink[], visibleNodeIds?: Set<string>): KnowledgeGraphData {
  const visible = visibleNodeIds ?? new Set(nodes.map((n) => n.id))
  const graphNodes: GraphNode[] = nodes
    .filter((n) => visible.has(n.id))
    .map((n) => ({ id: n.id, type: n.node_type, label: n.title }))

  const graphEdges: GraphEdge[] = edges
    .filter((edge) => Boolean(edge.generated_by) && visible.has(edge.source_id) && visible.has(edge.target_id))
    .map((edge) => ({ id: edge.id, sourceId: edge.source_id, targetId: edge.target_id, relationshipLabel: edge.relationship_type ?? 'related_to' }))

  return { nodes: graphNodes, edges: graphEdges }
}

export interface GraphViewState {
  focusedNodeId: string | null
  expandedNodeIds: Set<string>
  pinnedNodeIds: Set<string>
}

export function createGraphViewState(): GraphViewState {
  return { focusedNodeId: null, expandedNodeIds: new Set(), pinnedNodeIds: new Set() }
}

function buildAdjacency(edges: KnowledgeLink[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!edge.generated_by) continue
    if (!adjacency.has(edge.source_id)) adjacency.set(edge.source_id, new Set())
    if (!adjacency.has(edge.target_id)) adjacency.set(edge.target_id, new Set())
    adjacency.get(edge.source_id)!.add(edge.target_id)
    adjacency.get(edge.target_id)!.add(edge.source_id)
  }
  return adjacency
}

/** Direct neighbors of a node — the basis for "highlight neighborhood." */
export function getNeighbors(nodeId: string, edges: KnowledgeLink[]): string[] {
  return [...(buildAdjacency(edges).get(nodeId) ?? [])]
}

/** BFS out to `depth` hops — depth 1 is a node's immediate neighborhood. */
export function getNeighborhood(nodeId: string, edges: KnowledgeLink[], depth = 1): Set<string> {
  const adjacency = buildAdjacency(edges)
  const visited = new Set<string>([nodeId])
  let frontier = [nodeId]
  for (let hop = 0; hop < depth; hop++) {
    const next: string[] = []
    for (const current of frontier) {
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
  }
  visited.delete(nodeId)
  return visited
}

/** Unweighted BFS shortest path (by hop count) — the graph has no distance metric beyond adjacency. Returns null when no path exists (different components). */
export function findShortestPath(fromId: string, toId: string, edges: KnowledgeLink[]): string[] | null {
  if (fromId === toId) return [fromId]
  const adjacency = buildAdjacency(edges)
  const visited = new Set<string>([fromId])
  const queue: string[][] = [[fromId]]
  while (queue.length > 0) {
    const path = queue.shift()!
    const last = path[path.length - 1]!
    for (const neighbor of adjacency.get(last) ?? []) {
      if (neighbor === toId) return [...path, neighbor]
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push([...path, neighbor])
    }
  }
  return null
}

export function focusNode(state: GraphViewState, nodeId: string | null): GraphViewState {
  return { ...state, focusedNodeId: nodeId }
}

export function expandNode(state: GraphViewState, nodeId: string): GraphViewState {
  return { ...state, expandedNodeIds: new Set(state.expandedNodeIds).add(nodeId) }
}

export function collapseNode(state: GraphViewState, nodeId: string): GraphViewState {
  const next = new Set(state.expandedNodeIds)
  next.delete(nodeId)
  return { ...state, expandedNodeIds: next }
}

export function togglePin(state: GraphViewState, nodeId: string): GraphViewState {
  const next = new Set(state.pinnedNodeIds)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  return { ...state, pinnedNodeIds: next }
}

/**
 * UX-10 Phase 10 — which nodes should actually render given the current
 * view state: every pinned node, the focused node and its direct
 * neighborhood, and the neighbors of any explicitly expanded node. Falls
 * back to the full node set when nothing is focused/expanded/pinned yet
 * (the graph's default, unfiltered view).
 */
export function computeVisibleNodeIds(state: GraphViewState, nodes: KnowledgeNode[], edges: KnowledgeLink[]): Set<string> {
  if (!state.focusedNodeId && state.expandedNodeIds.size === 0 && state.pinnedNodeIds.size === 0) {
    return new Set(nodes.map((n) => n.id))
  }

  const visible = new Set<string>(state.pinnedNodeIds)
  if (state.focusedNodeId) {
    visible.add(state.focusedNodeId)
    for (const neighborId of getNeighborhood(state.focusedNodeId, edges, 1)) visible.add(neighborId)
  }
  for (const expandedId of state.expandedNodeIds) {
    visible.add(expandedId)
    for (const neighborId of getNeighbors(expandedId, edges)) visible.add(neighborId)
  }
  return visible
}
