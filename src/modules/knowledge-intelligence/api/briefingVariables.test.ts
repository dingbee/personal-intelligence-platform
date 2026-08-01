import { describe, expect, it } from 'vitest'
import { buildBriefingVariables } from '@/modules/knowledge-intelligence/api/briefingVariables'
import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { KnowledgeCollection, KnowledgeNode } from '@/shared/types/database'

function makeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    user_id: 'user-1',
    workspace_id: null,
    node_type: 'concept',
    title: 'Revenue',
    title_normalized: 'revenue',
    description: 'Money coming into the business.',
    source_type: 'document',
    source_id: 'doc-1',
    source_chunk_ids: null,
    generation_metadata: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildBriefingVariables', () => {
  it('formats related concepts and evidence sources into bullet lists', () => {
    const evidence: KnowledgeNodeEvidence = {
      node: makeNode(),
      countsBySourceType: { document: 1, note: 1 },
      evidence: [
        { type: 'document', id: 'doc-1', label: 'Q1 Report', createdAt: '2026-01-01T00:00:00Z' },
        { type: 'note', id: 'note-1', label: 'Revenue thoughts', createdAt: '2026-01-02T00:00:00Z' },
      ],
      relatedNodes: [{ nodeId: 'node-2', title: 'Marketing Campaign', relationshipType: 'relates_to', confidence: 0.8 }],
      confidence: 0.6,
    }

    const collections: KnowledgeCollection[] = [
      { id: 'coll-1', user_id: 'user-1', workspace_id: null, name: 'Q1 Planning', description: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ]

    const result = buildBriefingVariables(evidence, collections)

    expect(result.title).toBe('Revenue')
    expect(result.description).toBe('Money coming into the business.')
    expect(result.relatedConcepts).toBe('- Marketing Campaign (relates to)')
    expect(result.evidenceSources).toBe('- [document] Q1 Report\n- [note] Revenue thoughts')
    expect(result.confidence).toBe('60%')
    expect(result.collections).toBe('- Q1 Planning')
  })

  it('falls back to placeholder text when there is no description, related concepts, evidence, or collections', () => {
    const evidence: KnowledgeNodeEvidence = {
      node: makeNode({ description: null }),
      countsBySourceType: {},
      evidence: [],
      relatedNodes: [],
      confidence: 0,
    }

    const result = buildBriefingVariables(evidence)

    expect(result.description).toBe('No description recorded.')
    expect(result.relatedConcepts).toBe('None recorded.')
    expect(result.evidenceSources).toBe('None recorded.')
    expect(result.confidence).toBe('0%')
    expect(result.collections).toBe('None.')
  })
})
