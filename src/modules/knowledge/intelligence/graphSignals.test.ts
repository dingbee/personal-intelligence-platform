import { describe, expect, it } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { detectGraphSignals } from '@/modules/knowledge/intelligence/graphSignals'
import { computeConceptClusters } from '@/modules/knowledge/intelligence/conceptClusters'
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

describe('detectGraphSignals', () => {
  it('returns no signals for an empty graph', () => {
    expect(detectGraphSignals({ nodes: [], edges: [], clusters: [], nodeSources: [], now: NOW })).toEqual([])
  })

  it('flags a disconnected concept', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'disconnected_concept')).toBe(true)
  })

  it('flags a knowledge island when more than one cluster exists', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C'), makeNode('d', 'D')]
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')]
    const clusters = computeConceptClusters(nodes, edges)
    const signals = detectGraphSignals({ nodes, edges, clusters, nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'knowledge_island')).toBe(true)
  })

  it('does not flag a knowledge island with a single cluster', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const edges = [makeEdge('a', 'b')]
    const clusters = computeConceptClusters(nodes, edges)
    const signals = detectGraphSignals({ nodes, edges, clusters, nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'knowledge_island')).toBe(false)
  })

  it('flags an emerging topic with multiple recent sources', () => {
    const nodes = [makeNode('a', 'A', { updated_at: '2026-07-25T00:00:00.000Z' })]
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-2' },
    ]
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources, now: NOW })
    expect(signals.some((s) => s.type === 'emerging_topic')).toBe(true)
  })

  it('flags rapid growth when at least three concepts grew recently', () => {
    const nodes = ['a', 'b', 'c'].map((id) => makeNode(id, id.toUpperCase(), { updated_at: '2026-07-26T00:00:00.000Z' }))
    const nodeSources: KnowledgeNodeSourceRef[] = nodes.flatMap((n) => [
      { nodeId: n.id, sourceType: 'document', sourceId: `${n.id}-doc-1` },
      { nodeId: n.id, sourceType: 'document', sourceId: `${n.id}-doc-2` },
    ])
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources, now: NOW })
    expect(signals.some((s) => s.type === 'rapid_growth')).toBe(true)
  })

  it('does not flag rapid growth with fewer than three growing concepts', () => {
    const nodes = ['a', 'b'].map((id) => makeNode(id, id.toUpperCase(), { updated_at: '2026-07-26T00:00:00.000Z' }))
    const nodeSources: KnowledgeNodeSourceRef[] = nodes.flatMap((n) => [
      { nodeId: n.id, sourceType: 'document', sourceId: `${n.id}-doc-1` },
      { nodeId: n.id, sourceType: 'document', sourceId: `${n.id}-doc-2` },
    ])
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources, now: NOW })
    expect(signals.some((s) => s.type === 'rapid_growth')).toBe(false)
  })

  it('flags a high confidence cluster', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const edges = [makeEdge('a', 'b', { confidence: 0.95 })]
    const clusters = computeConceptClusters(nodes, edges)
    const signals = detectGraphSignals({ nodes, edges, clusters, nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'high_confidence_cluster')).toBe(true)
  })

  it('flags weak evidence for a low-confidence edge', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const edges = [makeEdge('a', 'b', { confidence: 0.1 })]
    const signals = detectGraphSignals({ nodes, edges, clusters: [], nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'weak_evidence')).toBe(true)
  })

  it('flags concept drift when a node was updated well after it was created', () => {
    const nodes = [makeNode('a', 'A', { created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-06-01T00:00:00.000Z' })]
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'concept_drift')).toBe(true)
  })

  it('does not flag concept drift for a freshly created, unmodified node', () => {
    const nodes = [makeNode('a', 'A', { created_at: '2026-07-28T00:00:00.000Z', updated_at: '2026-07-28T00:00:00.000Z' })]
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'concept_drift')).toBe(false)
  })

  it('flags duplicate concepts with highly overlapping normalized titles', () => {
    const nodes = [makeNode('a', 'Machine Learning Basics'), makeNode('b', 'Machine Learning Basics 101')]
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'duplicate_concept')).toBe(true)
  })

  it('does not flag duplicate concepts for unrelated titles', () => {
    const nodes = [makeNode('a', 'Marketing'), makeNode('b', 'Thermodynamics')]
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'duplicate_concept')).toBe(false)
  })

  it('does not flag duplicate concepts when they are already directly connected', () => {
    const nodes = [makeNode('a', 'Machine Learning Basics'), makeNode('b', 'Machine Learning Basics 101')]
    const edges = [makeEdge('a', 'b')]
    const signals = detectGraphSignals({ nodes, edges, clusters: [], nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'duplicate_concept')).toBe(false)
  })

  it('does not flag duplicate concepts across different node types', () => {
    const nodes = [
      makeNode('a', 'Machine Learning', { node_type: 'concept' }),
      makeNode('b', 'Machine Learning', { node_type: 'entity' }),
    ]
    const signals = detectGraphSignals({ nodes, edges: [], clusters: [], nodeSources: [], now: NOW })
    expect(signals.some((s) => s.type === 'duplicate_concept')).toBe(false)
  })
})
