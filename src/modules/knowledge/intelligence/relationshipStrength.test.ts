import { describe, expect, it } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import {
  computeRelationshipConfidence,
  computeRelationshipStrengths,
  scoreRelationship,
  type KnowledgeNodeSourceRef,
} from '@/modules/knowledge/intelligence/relationshipStrength'

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

describe('scoreRelationship', () => {
  it('scores 0 when there is no edge and no shared source', () => {
    const result = scoreRelationship('a', 'b', [], [])
    expect(result.score).toBe(0)
    expect(result.hasDirectEdge).toBe(false)
  })

  it('scores higher confidence edges higher', () => {
    const low = scoreRelationship('a', 'b', [makeEdge('a', 'b', { confidence: 0.2 })], [])
    const high = scoreRelationship('a', 'b', [makeEdge('a', 'b', { confidence: 0.9 })], [])
    expect(high.score).toBeGreaterThan(low.score)
  })

  it('finds an edge regardless of direction', () => {
    const result = scoreRelationship('b', 'a', [makeEdge('a', 'b')], [])
    expect(result.hasDirectEdge).toBe(true)
    expect(result.relationshipType).toBe('related_to')
  })

  it('ignores user-authored links with no generated_by', () => {
    const result = scoreRelationship('a', 'b', [makeEdge('a', 'b', { generated_by: null })], [])
    expect(result.hasDirectEdge).toBe(false)
  })

  it('counts shared document sources', () => {
    const sources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'doc-1' },
    ]
    const result = scoreRelationship('a', 'b', [], sources)
    expect(result.sharedSourceCount).toBe(1)
    expect(result.score).toBeGreaterThan(0)
  })

  it('caps score at 1', () => {
    const sources: KnowledgeNodeSourceRef[] = Array.from({ length: 10 }, (_, i) => [
      { nodeId: 'a', sourceType: 'document', sourceId: `doc-${i}` },
      { nodeId: 'b', sourceType: 'document', sourceId: `doc-${i}` },
    ]).flat()
    const result = scoreRelationship('a', 'b', [makeEdge('a', 'b', { confidence: 1 })], sources)
    expect(result.score).toBeLessThanOrEqual(1)
  })
})

describe('computeRelationshipStrengths', () => {
  it('returns one scored entry per AI-generated edge, sorted descending', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B'), makeNode('c', 'C')]
    const edges = [makeEdge('a', 'b', { confidence: 0.2 }), makeEdge('b', 'c', { confidence: 0.9 })]
    const result = computeRelationshipStrengths(nodes, edges, [])
    expect(result).toHaveLength(2)
    expect(result[0]!.score).toBeGreaterThanOrEqual(result[1]!.score)
  })

  it('excludes edges referencing nodes outside the given set', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'ghost')]
    const result = computeRelationshipStrengths(nodes, edges, [])
    expect(result).toHaveLength(1)
  })

  it('returns an empty array when there are no edges', () => {
    expect(computeRelationshipStrengths([makeNode('a', 'A')], [], [])).toEqual([])
  })
})

describe('computeRelationshipConfidence', () => {
  it('reports null relationship confidence when there is no edge, never fabricating a number', () => {
    const result = computeRelationshipConfidence('a', 'b', null, [])
    expect(result.relationship).toBeNull()
    expect(result.evidenceCount).toBe(0)
    expect(result.sources).toEqual([])
  })

  it('reads the edge confidence as-is (the model self-estimate), does not recompute it', () => {
    const result = computeRelationshipConfidence('a', 'b', makeEdge('a', 'b', { confidence: 0.82 }), [])
    expect(result.relationship).toBe(0.82)
  })

  it('counts a shared source of any type, not just documents', () => {
    const sources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'conversation', sourceId: 'conv-1' },
      { nodeId: 'b', sourceType: 'conversation', sourceId: 'conv-1' },
    ]
    const result = computeRelationshipConfidence('a', 'b', null, sources)
    expect(result.evidenceCount).toBe(1)
    expect(result.sources).toEqual(['conversation'])
  })

  it('lists distinct source types across multiple shared sources', () => {
    const sources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'a', sourceType: 'conversation', sourceId: 'conv-1' },
      { nodeId: 'b', sourceType: 'conversation', sourceId: 'conv-1' },
      { nodeId: 'a', sourceType: 'asset', sourceId: 'asset-1' },
      { nodeId: 'b', sourceType: 'asset', sourceId: 'asset-1' },
    ]
    const result = computeRelationshipConfidence('a', 'b', null, sources)
    expect(result.evidenceCount).toBe(3)
    expect(result.sources).toEqual(['asset', 'conversation', 'document'])
  })

  it('does not count a source only one of the two nodes has', () => {
    const sources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'doc-2' },
    ]
    const result = computeRelationshipConfidence('a', 'b', null, sources)
    expect(result.evidenceCount).toBe(0)
    expect(result.sources).toEqual([])
  })

  it('does not double-count duplicate source rows for the same id', () => {
    const sources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'same-id' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'same-id' },
      { nodeId: 'a', sourceType: 'document', sourceId: 'same-id' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'same-id' },
    ]
    const result = computeRelationshipConfidence('a', 'b', null, sources)
    expect(result.evidenceCount).toBe(1)
  })
})
