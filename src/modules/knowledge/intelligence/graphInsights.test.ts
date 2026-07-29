import { describe, expect, it } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { computeGraphInsights, type DocumentRef } from '@/modules/knowledge/intelligence/graphInsights'
import type { KnowledgeNodeSourceRef } from '@/modules/knowledge/intelligence/relationshipStrength'

const NOW = new Date('2026-07-29T00:00:00.000Z')

function makeNode(id: string, title: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
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
    ...overrides,
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

describe('computeGraphInsights', () => {
  it('returns an empty list for an empty graph', () => {
    expect(computeGraphInsights({ nodes: [], edges: [], nodeSources: [], documents: [], now: NOW })).toEqual([])
  })

  it('identifies the most connected concept', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C')]
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c')]
    const insights = computeGraphInsights({ nodes, edges, nodeSources: [], documents: [], now: NOW })
    const insight = insights.find((i) => i.type === 'most_connected_concept')
    expect(insight?.nodeId).toBe('a')
    expect(insight?.value).toContain('2 connections')
  })

  it('identifies an isolated concept', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const edges = [makeEdge('a', 'b')]
    const nodesWithIsolated = [...nodes, makeNode('c', 'C')]
    const insights = computeGraphInsights({ nodes: nodesWithIsolated, edges, nodeSources: [], documents: [], now: NOW })
    expect(insights.find((i) => i.type === 'isolated_concept')?.nodeId).toBe('c')
  })

  it('identifies a weakly connected concept (degree 1)', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C')]
    const edges = [makeEdge('a', 'b')]
    const insights = computeGraphInsights({ nodes, edges, nodeSources: [], documents: [], now: NOW })
    const insight = insights.find((i) => i.type === 'weakly_connected_concept')
    expect(['a', 'b']).toContain(insight?.nodeId)
  })

  it('identifies the most recently created concept', () => {
    const nodes = [
      makeNode('a', 'A', { created_at: '2026-01-01T00:00:00.000Z' }),
      makeNode('b', 'B', { created_at: '2026-07-01T00:00:00.000Z' }),
    ]
    const insights = computeGraphInsights({ nodes, edges: [], nodeSources: [], documents: [], now: NOW })
    expect(insights.find((i) => i.type === 'recently_expanded_knowledge')?.nodeId).toBe('b')
  })

  it('identifies a frequently referenced concept when it has more than one document source', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-2' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'doc-1' },
    ]
    const insights = computeGraphInsights({ nodes, edges: [], nodeSources, documents: [], now: NOW })
    expect(insights.find((i) => i.type === 'frequently_referenced_concept')?.nodeId).toBe('a')
  })

  it('does not surface frequently_referenced_concept when no node has more than one source', () => {
    const nodes = [makeNode('a', 'A')]
    const nodeSources: KnowledgeNodeSourceRef[] = [{ nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' }]
    const insights = computeGraphInsights({ nodes, edges: [], nodeSources, documents: [], now: NOW })
    expect(insights.find((i) => i.type === 'frequently_referenced_concept')).toBeUndefined()
  })

  it('identifies a fastest growing topic when a node gained multiple recent sources', () => {
    const nodes = [makeNode('a', 'A', { updated_at: '2026-07-25T00:00:00.000Z' })]
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-2' },
    ]
    const insights = computeGraphInsights({ nodes, edges: [], nodeSources, documents: [], now: NOW })
    expect(insights.find((i) => i.type === 'fastest_growing_topic')?.nodeId).toBe('a')
  })

  it('does not surface fastest_growing_topic when the node was not recently updated', () => {
    const nodes = [makeNode('a', 'A', { updated_at: '2025-01-01T00:00:00.000Z' })]
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-2' },
    ]
    const insights = computeGraphInsights({ nodes, edges: [], nodeSources, documents: [], now: NOW })
    expect(insights.find((i) => i.type === 'fastest_growing_topic')).toBeUndefined()
  })

  it('identifies a concept spanning multiple workspaces', () => {
    const nodes = [makeNode('a', 'A')]
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-2' },
    ]
    const documents: DocumentRef[] = [
      { id: 'doc-1', title: 'Doc 1', workspace_id: 'ws-1' },
      { id: 'doc-2', title: 'Doc 2', workspace_id: 'ws-2' },
    ]
    const insights = computeGraphInsights({ nodes, edges: [], nodeSources, documents, now: NOW })
    expect(insights.find((i) => i.type === 'cross_workspace_concept')?.nodeId).toBe('a')
  })

  it('does not flag cross_workspace_concept when all sources share one workspace', () => {
    const nodes = [makeNode('a', 'A')]
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-2' },
    ]
    const documents: DocumentRef[] = [
      { id: 'doc-1', title: 'Doc 1', workspace_id: 'ws-1' },
      { id: 'doc-2', title: 'Doc 2', workspace_id: 'ws-1' },
    ]
    const insights = computeGraphInsights({ nodes, edges: [], nodeSources, documents, now: NOW })
    expect(insights.find((i) => i.type === 'cross_workspace_concept')).toBeUndefined()
  })

  it('ignores user-authored (non-AI-generated) edges when computing degree', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const edges = [makeEdge('a', 'b', { generated_by: null })]
    const insights = computeGraphInsights({ nodes, edges, nodeSources: [], documents: [], now: NOW })
    expect(insights.find((i) => i.type === 'most_connected_concept')).toBeUndefined()
    expect(insights.filter((i) => i.type === 'isolated_concept')).toHaveLength(1)
  })
})
