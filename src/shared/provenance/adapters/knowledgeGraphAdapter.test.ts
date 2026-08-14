import { describe, expect, it } from 'vitest'
import { knowledgeNodeEvidenceToProvenance } from '@/shared/provenance/adapters/knowledgeGraphAdapter'
import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { KnowledgeNode } from '@/shared/types/database'

function buildEvidence(overrides: Partial<KnowledgeNodeEvidence> = {}): KnowledgeNodeEvidence {
  return {
    node: { id: 'node-1', title: 'Return Policy' } as KnowledgeNode,
    countsBySourceType: { document: 1 },
    evidence: [{ type: 'document', id: 'doc-1', label: 'Returns Policy 2024', createdAt: '2024-01-01T00:00:00.000Z' }],
    relatedNodes: [],
    confidence: 0.7,
    ...overrides,
  }
}

describe('knowledgeNodeEvidenceToProvenance', () => {
  it('maps the node to a knowledge_node source and each evidence item to a real-source EvidenceReference', () => {
    const { source, items } = knowledgeNodeEvidenceToProvenance(buildEvidence())
    expect(source).toEqual({ type: 'knowledge_node', id: 'node-1', title: 'Return Policy' })
    expect(items).toHaveLength(1)
    expect(items[0]!.source).toEqual({ type: 'document', id: 'doc-1', title: 'Returns Policy 2024' })
    expect(items[0]!.location).toEqual({ kind: 'whole' })
    expect(items[0]!.retrievedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('drops an evidence item whose source type is not one of the shared model\'s known types, rather than guessing', () => {
    const { items } = knowledgeNodeEvidenceToProvenance(buildEvidence({ evidence: [{ type: 'some_future_type', id: 'x', label: 'x', createdAt: '2024-01-01T00:00:00.000Z' }] }))
    expect(items).toEqual([])
  })
})
