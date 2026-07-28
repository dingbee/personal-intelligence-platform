import { describe, expect, it } from 'vitest'
import type { KnowledgeNode } from '@/shared/types/database'
import { buildEdgeInputsFromRelationships } from '@/modules/knowledge-intelligence/api/knowledgeRelationships'

function makeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: overrides.title ?? 'node-id',
    user_id: 'user-1',
    workspace_id: null,
    node_type: 'concept',
    title: 'Untitled',
    title_normalized: 'untitled',
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

const params = { userId: 'user-1', workspaceId: null, generatedBy: 'ai:test' }

describe('buildEdgeInputsFromRelationships', () => {
  it('matches source/target titles to node ids and preserves relationshipType/confidence', () => {
    const nodes = [makeNode({ id: 'n1', title: 'Marie Curie' }), makeNode({ id: 'n2', title: 'Radium' })]
    const edges = buildEdgeInputsFromRelationships(
      nodes,
      [{ source: 'Marie Curie', target: 'Radium', relationshipType: 'discovered', confidence: 0.9 }],
      params,
    )
    expect(edges).toEqual([
      {
        userId: 'user-1',
        workspaceId: null,
        sourceType: 'knowledge_node',
        sourceId: 'n1',
        targetType: 'knowledge_node',
        targetId: 'n2',
        relationshipType: 'discovered',
        confidence: 0.9,
        generatedBy: 'ai:test',
      },
    ])
  })

  it('drops a relationship whose source title has no matching node', () => {
    const nodes = [makeNode({ id: 'n2', title: 'Radium' })]
    const edges = buildEdgeInputsFromRelationships(
      nodes,
      [{ source: 'Marie Curie', target: 'Radium', relationshipType: 'discovered', confidence: 0.9 }],
      params,
    )
    expect(edges).toEqual([])
  })

  it('drops a relationship whose target title has no matching node', () => {
    const nodes = [makeNode({ id: 'n1', title: 'Marie Curie' })]
    const edges = buildEdgeInputsFromRelationships(
      nodes,
      [{ source: 'Marie Curie', target: 'Radium', relationshipType: 'discovered', confidence: 0.9 }],
      params,
    )
    expect(edges).toEqual([])
  })

  it('drops a self-loop (source and target resolve to the same node id)', () => {
    const nodes = [makeNode({ id: 'n1', title: 'Marie Curie' })]
    const edges = buildEdgeInputsFromRelationships(
      nodes,
      [{ source: 'Marie Curie', target: 'Marie Curie', relationshipType: 'relates_to', confidence: 0.5 }],
      params,
    )
    expect(edges).toEqual([])
  })

  it('preserves a null confidence rather than coercing it', () => {
    const nodes = [makeNode({ id: 'n1', title: 'A' }), makeNode({ id: 'n2', title: 'B' })]
    const edges = buildEdgeInputsFromRelationships(
      nodes,
      [{ source: 'A', target: 'B', relationshipType: 'relates_to', confidence: null }],
      params,
    )
    expect(edges[0]!.confidence).toBeNull()
  })

  it('processes multiple relationships independently, keeping only the valid ones', () => {
    const nodes = [makeNode({ id: 'n1', title: 'A' }), makeNode({ id: 'n2', title: 'B' })]
    const edges = buildEdgeInputsFromRelationships(
      nodes,
      [
        { source: 'A', target: 'B', relationshipType: 'relates_to', confidence: 0.8 },
        { source: 'A', target: 'Nonexistent', relationshipType: 'relates_to', confidence: 0.2 },
        { source: 'A', target: 'A', relationshipType: 'relates_to', confidence: 0.1 },
      ],
      params,
    )
    expect(edges).toHaveLength(1)
    expect(edges[0]!.targetId).toBe('n2')
  })

  it('returns an empty array for an empty relationship list', () => {
    expect(buildEdgeInputsFromRelationships([makeNode()], [], params)).toEqual([])
  })
})
