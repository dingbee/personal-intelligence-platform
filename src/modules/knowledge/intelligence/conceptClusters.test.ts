import { describe, expect, it } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { computeConceptClusters } from '@/modules/knowledge/intelligence/conceptClusters'

function makeNode(id: string, title: string): KnowledgeNode {
  return {
    id,
    user_id: 'u1',
    workspace_id: null,
    node_type: 'concept',
    title,
    title_normalized: title.toLowerCase(),
    description: null,
    source_type: 'document',
    source_id: 'doc-1',
    source_chunk_ids: null,
    generation_metadata: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function makeEdge(sourceId: string, targetId: string, overrides: Partial<KnowledgeLink> = {}): KnowledgeLink {
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
    generated_by: 'ai:test',
    metadata: null,
    ...overrides,
  }
}

describe('computeConceptClusters', () => {
  it('returns no clusters for a graph with no edges', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    expect(computeConceptClusters(nodes, [])).toEqual([])
  })

  it('groups directly connected nodes into one cluster', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    const clusters = computeConceptClusters(nodes, edges)
    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.nodeIds.sort()).toEqual(['a', 'b', 'c'])
    expect(clusters[0]!.size).toBe(3)
  })

  it('separates disconnected components into distinct clusters', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C'), makeNode('d', 'D')]
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')]
    const clusters = computeConceptClusters(nodes, edges)
    expect(clusters).toHaveLength(2)
  })

  it('excludes singleton (unconnected) nodes from clusters', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('lonely', 'Lonely')]
    const edges = [makeEdge('a', 'b')]
    const clusters = computeConceptClusters(nodes, edges)
    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.nodeIds).not.toContain('lonely')
  })

  it('labels a cluster using its highest-degree node title', () => {
    const nodes = [makeNode('hub', 'Hub'), makeNode('a', 'A'), makeNode('b', 'B')]
    const edges = [makeEdge('hub', 'a'), makeEdge('hub', 'b')]
    const clusters = computeConceptClusters(nodes, edges)
    expect(clusters[0]!.label).toBe('Hub')
  })

  it('computes density as edges present over possible edges', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('a', 'c')]
    const clusters = computeConceptClusters(nodes, edges)
    expect(clusters[0]!.density).toBe(1)
  })

  it('sorts clusters by size descending', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C'), makeNode('d', 'D'), makeNode('e', 'E')]
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd'), makeEdge('d', 'e')]
    const clusters = computeConceptClusters(nodes, edges)
    expect(clusters[0]!.size).toBe(3)
    expect(clusters[1]!.size).toBe(2)
  })

  it('ignores user-authored (non-AI-generated) edges', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const edges = [makeEdge('a', 'b', { generated_by: null })]
    expect(computeConceptClusters(nodes, edges)).toEqual([])
  })
})
