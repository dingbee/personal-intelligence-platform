import { describe, expect, it, vi } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

const { generateKnowledgeMapMock, listKnowledgeNodeSourcesForNodesMock, listDocumentsMock } = vi.hoisted(() => ({
  generateKnowledgeMapMock: vi.fn(async () => ({ nodes: [] as KnowledgeNode[], edges: [] as KnowledgeLink[] })),
  listKnowledgeNodeSourcesForNodesMock: vi.fn(async () => [] as { nodeId: string; sourceType: string; sourceId: string }[]),
  listDocumentsMock: vi.fn(async () => [] as { id: string; title: string; workspace_id: string | null }[]),
}))

vi.mock('@/modules/knowledge-intelligence/api/knowledgeMap', () => ({ generateKnowledgeMap: generateKnowledgeMapMock }))
vi.mock('@/modules/knowledge-intelligence/api/knowledgeNodes', () => ({
  listKnowledgeNodeSourcesForNodes: listKnowledgeNodeSourcesForNodesMock,
}))
vi.mock('@/modules/library/api/documents', () => ({ listDocuments: listDocumentsMock }))

import { buildGraphInteractionState } from '@/modules/knowledge/intelligence/graphInteraction'

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

function makeEdge(sourceId: string, targetId: string): KnowledgeLink {
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
    confidence: 0.9,
    generated_by: 'ai:test',
    metadata: null,
  }
}

describe('buildGraphInteractionState', () => {
  it('returns a fully-shaped, empty GraphInteractionState for an empty graph', async () => {
    const state = await buildGraphInteractionState({ workspaceId: null })
    expect(state).toEqual({ clusters: [], insights: [], signals: [], suggestions: [], relationships: [], references: [] })
  })

  it('composes clusters/insights/signals/suggestions/relationships from a populated graph', async () => {
    generateKnowledgeMapMock.mockResolvedValueOnce({
      nodes: [makeNode('a', 'A'), makeNode('b', 'B')],
      edges: [makeEdge('a', 'b')],
    })
    listKnowledgeNodeSourcesForNodesMock.mockResolvedValueOnce([
      { nodeId: 'a', sourceType: 'document', sourceId: 'doc-1' },
    ])
    listDocumentsMock.mockResolvedValueOnce([{ id: 'doc-1', title: 'Deep Work', workspace_id: null }])

    const state = await buildGraphInteractionState({ workspaceId: null })
    expect(state.clusters).toHaveLength(1)
    expect(state.relationships).toHaveLength(1)
    expect(state.insights.length).toBeGreaterThan(0)
    expect(state.references.some((r) => r.type === 'document' && r.title === 'Deep Work')).toBe(true)
  })

  it('degrades gracefully when every underlying fetch fails', async () => {
    generateKnowledgeMapMock.mockRejectedValueOnce(new Error('boom'))
    listKnowledgeNodeSourcesForNodesMock.mockRejectedValueOnce(new Error('boom'))
    listDocumentsMock.mockRejectedValueOnce(new Error('boom'))

    const state = await buildGraphInteractionState({ workspaceId: null })
    expect(state.clusters).toEqual([])
    expect(state.insights).toEqual([])
    expect(state.references).toEqual([])
  })
})
