import { describe, expect, it } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { explainConnection } from '@/modules/knowledge/intelligence/graphExplorer'
import type { KnowledgeNodeSourceRef } from '@/modules/knowledge/intelligence/relationshipStrength'
import type { DocumentRef } from '@/modules/knowledge/intelligence/graphInsights'

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

describe('explainConnection', () => {
  it('reports no connection when nothing links the two nodes', () => {
    const result = explainConnection(makeNode('a', 'A'), makeNode('b', 'B'), [], [], [])
    expect(result.connected).toBe(false)
    expect(result.explanation).toContain('No known connection')
  })

  it('explains a direct AI-generated relationship with its confidence', () => {
    const edges = [makeEdge('a', 'b', { relationship_type: 'causes', confidence: 0.75 })]
    const result = explainConnection(makeNode('a', 'A'), makeNode('b', 'B'), edges, [], [])
    expect(result.connected).toBe(true)
    expect(result.directRelationship).toEqual({ relationshipType: 'causes', confidence: 0.75 })
    expect(result.explanation).toContain('causes')
    expect(result.explanation).toContain('75%')
  })

  it('finds the direct edge regardless of source/target order', () => {
    const edges = [makeEdge('b', 'a')]
    const result = explainConnection(makeNode('a', 'A'), makeNode('b', 'B'), edges, [], [])
    expect(result.connected).toBe(true)
  })

  it('explains shared documents even without a direct edge', () => {
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'doc-1' },
    ]
    const documents: DocumentRef[] = [{ id: 'doc-1', title: 'Shared Doc', workspace_id: null }]
    const result = explainConnection(makeNode('a', 'A'), makeNode('b', 'B'), [], nodeSources, documents)
    expect(result.connected).toBe(true)
    expect(result.sharedDocuments).toEqual([{ id: 'doc-1', title: 'Shared Doc' }])
    expect(result.explanation).toContain('Shared Doc')
  })

  it('does not count a document only one of the two nodes came from', () => {
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'doc-2' },
    ]
    const documents: DocumentRef[] = [
      { id: 'doc-1', title: 'Doc 1', workspace_id: null },
      { id: 'doc-2', title: 'Doc 2', workspace_id: null },
    ]
    const result = explainConnection(makeNode('a', 'A'), makeNode('b', 'B'), [], nodeSources, documents)
    expect(result.sharedDocuments).toEqual([])
    expect(result.connected).toBe(false)
  })

  it('ignores user-authored links (no generated_by) as a direct relationship', () => {
    const edges = [makeEdge('a', 'b', { generated_by: null })]
    const result = explainConnection(makeNode('a', 'A'), makeNode('b', 'B'), edges, [], [])
    expect(result.directRelationship).toBeNull()
  })

  it('combines a direct relationship with shared documents in the explanation', () => {
    const edges = [makeEdge('a', 'b')]
    const nodeSources: KnowledgeNodeSourceRef[] = [
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
      { nodeId: 'b', sourceType: 'document', sourceId: 'doc-1' },
    ]
    const documents: DocumentRef[] = [{ id: 'doc-1', title: 'Doc 1', workspace_id: null }]
    const result = explainConnection(makeNode('a', 'A'), makeNode('b', 'B'), edges, nodeSources, documents)
    expect(result.explanation).toContain('related to')
    expect(result.explanation).toContain('Doc 1')
  })
})
