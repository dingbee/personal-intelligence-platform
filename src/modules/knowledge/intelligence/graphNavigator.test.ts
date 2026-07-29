import { describe, expect, it } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import {
  collapseNode,
  computeVisibleNodeIds,
  createGraphViewState,
  expandNode,
  findShortestPath,
  focusNode,
  getNeighborhood,
  getNeighbors,
  toGraphData,
  togglePin,
} from '@/modules/knowledge/intelligence/graphNavigator'

function makeNode(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    user_id: 'u1',
    workspace_id: null,
    node_type: 'concept',
    title: id,
    title_normalized: id,
    description: null,
    source_type: 'document',
    source_id: 'doc-1',
    source_chunk_ids: null,
    generation_metadata: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeEdge(sourceId: string, targetId: string, generatedBy: string | null = 'ai:test'): KnowledgeLink {
  return {
    id: `${sourceId}-${targetId}`,
    user_id: 'u1',
    workspace_id: null,
    source_type: 'knowledge_node',
    source_id: sourceId,
    target_type: 'knowledge_node',
    target_id: targetId,
    created_at: '2026-01-01T00:00:00.000Z',
    relationship_type: 'related_to',
    confidence: 0.8,
    generated_by: generatedBy,
    metadata: null,
  }
}

describe('getNeighbors', () => {
  it('returns direct neighbors in both directions', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'a')]
    expect(getNeighbors('a', edges).sort()).toEqual(['b', 'c'])
  })

  it('returns an empty array for a node with no edges', () => {
    expect(getNeighbors('lonely', [makeEdge('a', 'b')])).toEqual([])
  })

  it('ignores user-authored links', () => {
    expect(getNeighbors('a', [makeEdge('a', 'b', null)])).toEqual([])
  })
})

describe('getNeighborhood', () => {
  it('expands to depth 2', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    expect(getNeighborhood('a', edges, 2)).toEqual(new Set(['b', 'c']))
  })

  it('does not include the origin node itself', () => {
    const edges = [makeEdge('a', 'b')]
    expect(getNeighborhood('a', edges, 1).has('a')).toBe(false)
  })
})

describe('findShortestPath', () => {
  it('returns the direct path for adjacent nodes', () => {
    expect(findShortestPath('a', 'b', [makeEdge('a', 'b')])).toEqual(['a', 'b'])
  })

  it('returns the shortest multi-hop path', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('a', 'd'), makeEdge('d', 'c')]
    const path = findShortestPath('a', 'c', edges)
    expect(path).toHaveLength(3)
  })

  it('returns null when no path exists', () => {
    expect(findShortestPath('a', 'z', [makeEdge('a', 'b')])).toBeNull()
  })

  it('returns a single-element path for identical endpoints', () => {
    expect(findShortestPath('a', 'a', [])).toEqual(['a'])
  })
})

describe('graph view state transitions', () => {
  it('starts with nothing focused, expanded, or pinned', () => {
    const state = createGraphViewState()
    expect(state.focusedNodeId).toBeNull()
    expect(state.expandedNodeIds.size).toBe(0)
    expect(state.pinnedNodeIds.size).toBe(0)
  })

  it('focusNode sets the focused id without mutating the original state', () => {
    const state = createGraphViewState()
    const next = focusNode(state, 'a')
    expect(next.focusedNodeId).toBe('a')
    expect(state.focusedNodeId).toBeNull()
  })

  it('expandNode adds to expandedNodeIds', () => {
    const next = expandNode(createGraphViewState(), 'a')
    expect(next.expandedNodeIds.has('a')).toBe(true)
  })

  it('collapseNode removes from expandedNodeIds', () => {
    const expanded = expandNode(createGraphViewState(), 'a')
    const collapsed = collapseNode(expanded, 'a')
    expect(collapsed.expandedNodeIds.has('a')).toBe(false)
  })

  it('togglePin adds then removes a pin', () => {
    const pinned = togglePin(createGraphViewState(), 'a')
    expect(pinned.pinnedNodeIds.has('a')).toBe(true)
    const unpinned = togglePin(pinned, 'a')
    expect(unpinned.pinnedNodeIds.has('a')).toBe(false)
  })
})

describe('computeVisibleNodeIds', () => {
  const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')]
  const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]

  it('shows every node by default (no focus, expand, or pin)', () => {
    const visible = computeVisibleNodeIds(createGraphViewState(), nodes, edges)
    expect(visible).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('shows only the focused node and its neighborhood when focused', () => {
    const state = focusNode(createGraphViewState(), 'a')
    expect(computeVisibleNodeIds(state, nodes, edges)).toEqual(new Set(['a', 'b']))
  })

  it('always includes pinned nodes regardless of focus', () => {
    let state = focusNode(createGraphViewState(), 'a')
    state = togglePin(state, 'd')
    expect(computeVisibleNodeIds(state, nodes, edges)).toEqual(new Set(['a', 'b', 'd']))
  })

  it('reveals neighbors of an explicitly expanded node', () => {
    const state = expandNode(createGraphViewState(), 'c')
    expect(computeVisibleNodeIds(state, nodes, edges)).toEqual(new Set(['c', 'b']))
  })
})

describe('toGraphData', () => {
  it('maps concept/entity nodes and AI-generated edges into GraphNode/GraphEdge shape', () => {
    const nodes = [makeNode('a', { node_type: 'concept', title: 'A' }), makeNode('b', { node_type: 'entity', title: 'B' })]
    const edges = [makeEdge('a', 'b', 'ai:test')]
    const data = toGraphData(nodes, edges)
    expect(data.nodes).toEqual([
      { id: 'a', type: 'concept', label: 'A' },
      { id: 'b', type: 'entity', label: 'B' },
    ])
    expect(data.edges).toEqual([{ id: 'a-b', sourceId: 'a', targetId: 'b', relationshipLabel: 'related_to' }])
  })

  it('narrows to only the visible node set when provided', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    const data = toGraphData(nodes, edges, new Set(['a', 'b']))
    expect(data.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
    expect(data.edges).toHaveLength(1)
  })

  it('excludes user-authored (non-AI-generated) edges', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const edges = [makeEdge('a', 'b', null)]
    expect(toGraphData(nodes, edges).edges).toEqual([])
  })
})
