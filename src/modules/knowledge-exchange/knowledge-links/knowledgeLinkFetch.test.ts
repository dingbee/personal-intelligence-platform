import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { fetchKnowledgeLinkForExport } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkFetch'

function fakeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'current-node',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: null,
    source_type: 'document',
    source_id: 'doc-1',
    source_chunk_ids: [],
    generation_metadata: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakeLink(overrides: Partial<KnowledgeLink> = {}): KnowledgeLink {
  return {
    id: 'link-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    source_type: 'knowledge_node',
    source_id: 'current-node',
    target_type: 'knowledge_node',
    target_id: 'related-node',
    created_at: '2026-01-05T00:00:00.000Z',
    relationship_type: 'requires',
    confidence: 0.9,
    generated_by: 'ai:detect-relationships',
    metadata: null,
    ...overrides,
  }
}

/** A minimal chainable query-builder stub matching only the methods `fetchKnowledgeLinkForExport` actually calls. */
function chainable(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = () => builder
  builder.maybeSingle = () => Promise.resolve(result)
  builder.single = () => Promise.resolve(result)
  return builder
}

describe('fetchKnowledgeLinkForExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the correct source/target direction when the current node is the source', async () => {
    const link = fakeLink()
    const relatedNode = fakeNode({ id: 'related-node', title: 'Chlorophyll' })

    fromMock.mockImplementation((table: string) => {
      if (table === 'knowledge_links') {
        return chainable({ data: link, error: null })
      }
      return chainable({ data: relatedNode, error: null })
    })

    const currentNode = fakeNode()
    const result = await fetchKnowledgeLinkForExport({ currentNode, relatedNodeId: 'related-node' })

    expect(result.link).toBe(link)
    expect(result.sourceNode).toBe(currentNode)
    expect(result.targetNode).toBe(relatedNode)
  })

  it('resolves the correct source/target direction when the current node is the target', async () => {
    const link = fakeLink({ source_id: 'related-node', target_id: 'current-node' })
    const relatedNode = fakeNode({ id: 'related-node', title: 'Chlorophyll' })
    let callIndex = 0

    fromMock.mockImplementation((table: string) => {
      if (table === 'knowledge_links') {
        callIndex += 1
        // First call is the "current is source" direction (no match), second is "current is target" (match).
        return callIndex === 1 ? chainable({ data: null, error: null }) : chainable({ data: link, error: null })
      }
      return chainable({ data: relatedNode, error: null })
    })

    const currentNode = fakeNode()
    const result = await fetchKnowledgeLinkForExport({ currentNode, relatedNodeId: 'related-node' })

    expect(result.sourceNode).toBe(relatedNode)
    expect(result.targetNode).toBe(currentNode)
  })

  it('throws a clear error when the relationship no longer exists', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'knowledge_links') return chainable({ data: null, error: null })
      return chainable({ data: fakeNode({ id: 'related-node' }), error: null })
    })

    await expect(fetchKnowledgeLinkForExport({ currentNode: fakeNode(), relatedNodeId: 'related-node' })).rejects.toThrow(
      'no longer exists',
    )
  })
})
