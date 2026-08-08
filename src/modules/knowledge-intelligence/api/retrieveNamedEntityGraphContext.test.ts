import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, getKnowledgeNodeEvidenceMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getKnowledgeNodeEvidenceMock: vi.fn(),
}))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))
vi.mock('@/modules/knowledge-intelligence/api/knowledgeNodeEvidence', () => ({ getKnowledgeNodeEvidence: getKnowledgeNodeEvidenceMock }))

import { formatNamedEntityGraphContext, retrieveNamedEntityGraphContext } from '@/modules/knowledge-intelligence/api/retrieveNamedEntityGraphContext'

function nodeQueryChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(async () => result),
  }
  return chain
}

/**
 * PIP Sprint 5/10 — the graph-layer counterpart of Sprint 4's ARRIYIA
 * fix: a chat question naming an entity directly must reach that
 * entity's real graph evidence (getKnowledgeNodeEvidence), not only
 * whatever nodes happen to be sourced from documents a chunk search
 * already matched.
 */
describe('retrieveNamedEntityGraphContext', () => {
  beforeEach(() => {
    fromMock.mockClear()
    getKnowledgeNodeEvidenceMock.mockClear()
  })

  it('returns null when the question has no entity-like terms — never queries the graph for nothing', async () => {
    const result = await retrieveNamedEntityGraphContext({ text: 'what is the summary here', userId: 'u1' })
    expect(result).toBeNull()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('looks up a knowledge node by normalized title for the extracted entity term', async () => {
    fromMock.mockReturnValueOnce(nodeQueryChain({ data: [{ id: 'node-1', title: 'ARRIYIA', node_type: 'entity' }], error: null }))
    getKnowledgeNodeEvidenceMock.mockResolvedValueOnce({
      node: { id: 'node-1', title: 'ARRIYIA', node_type: 'entity' },
      countsBySourceType: { document: 1 },
      evidence: [{ type: 'document', id: 'doc-1', label: 'Northern Expansion Plan.pdf', createdAt: new Date().toISOString() }],
      relatedNodes: [],
      confidence: 0.5,
    })

    const result = await retrieveNamedEntityGraphContext({ text: 'What is ARRIYIA connected to?', userId: 'u1' })
    expect(result).toContain('Entity: ARRIYIA')
    expect(result).toContain('Northern Expansion Plan.pdf')
  })

  it('returns null when no node matches any extracted term — never fabricates a connection', async () => {
    fromMock.mockReturnValueOnce(nodeQueryChain({ data: [], error: null }))
    const result = await retrieveNamedEntityGraphContext({ text: 'Does the document mention ZYNTHOCORP?', userId: 'u1' })
    expect(result).toBeNull()
    expect(getKnowledgeNodeEvidenceMock).not.toHaveBeenCalled()
  })

  it('never throws — a Supabase failure returns null, same never-throws contract as retrieveGraphContext', async () => {
    fromMock.mockImplementationOnce(() => {
      throw new Error('network error')
    })
    const result = await retrieveNamedEntityGraphContext({ text: 'What is ARRIYIA connected to?', userId: 'u1' })
    expect(result).toBeNull()
  })
})

describe('formatNamedEntityGraphContext', () => {
  it('labels low-confidence nodes as provisional rather than presenting them with false certainty', () => {
    const text = formatNamedEntityGraphContext([
      {
        node: { id: 'n1', title: 'ARRIYIA', node_type: 'entity' } as never,
        countsBySourceType: { note: 1 },
        evidence: [{ type: 'note', id: 'note-1', label: 'Planning notes', createdAt: new Date().toISOString() }],
        relatedNodes: [],
        confidence: 0.2,
      },
    ])
    expect(text).toContain('very limited evidence')
  })

  it('does not add a caveat for well-corroborated nodes', () => {
    const text = formatNamedEntityGraphContext([
      {
        node: { id: 'n1', title: 'ARRIYIA', node_type: 'entity' } as never,
        countsBySourceType: { document: 3, note: 2 },
        evidence: [],
        relatedNodes: [],
        confidence: 0.8,
      },
    ])
    expect(text).not.toContain('limited evidence')
  })

  it('shows relationship evidence count and source types so the model can distinguish corroborated from merely inferred connections', () => {
    const text = formatNamedEntityGraphContext([
      {
        node: { id: 'n1', title: 'ARRIYIA', node_type: 'entity' } as never,
        countsBySourceType: { document: 1 },
        evidence: [],
        relatedNodes: [
          {
            nodeId: 'n2',
            title: 'Northern Expansion',
            relationshipType: 'manages',
            confidence: 0.7,
            relationshipConfidence: { relationship: 0.7, evidenceCount: 2, sources: ['document', 'note'] },
          },
        ],
        confidence: 0.6,
      },
    ])
    expect(text).toContain('manages Northern Expansion')
    expect(text).toContain('corroborated by 2 shared sources (document, note)')
  })

  it('marks a relationship with no shared evidence as inferred, not corroborated', () => {
    const text = formatNamedEntityGraphContext([
      {
        node: { id: 'n1', title: 'ARRIYIA', node_type: 'entity' } as never,
        countsBySourceType: { document: 1 },
        evidence: [],
        relatedNodes: [
          {
            nodeId: 'n2',
            title: 'Some Concept',
            relationshipType: 'relates_to',
            confidence: 0.3,
            relationshipConfidence: { relationship: 0.3, evidenceCount: 0, sources: [] },
          },
        ],
        confidence: 0.4,
      },
    ])
    expect(text).toContain('inferred, not directly corroborated')
  })

  it('returns null for an empty evidence list', () => {
    expect(formatNamedEntityGraphContext([])).toBeNull()
  })
})
