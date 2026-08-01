import { describe, expect, it } from 'vitest'
import { buildKnowledgeExportMarkdown, knowledgeExportFilename } from '@/modules/knowledge-intelligence/api/knowledgeExportMarkdown'
import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { KnowledgeNode } from '@/shared/types/database'

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

describe('buildKnowledgeExportMarkdown', () => {
  it('renders title, confidence, related concepts, and grouped evidence', () => {
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

    const markdown = buildKnowledgeExportMarkdown(evidence)

    expect(markdown).toContain('# Revenue')
    expect(markdown).toContain('Knowledge Confidence: 60%')
    expect(markdown).toContain('Money coming into the business.')
    expect(markdown).toContain('## Related Concepts')
    expect(markdown).toContain('- Marketing Campaign (relates to)')
    expect(markdown).toContain('### Documents')
    expect(markdown).toContain('- Q1 Report')
    expect(markdown).toContain('### Notes')
    expect(markdown).toContain('- Revenue thoughts')
  })

  it('omits Related Concepts and Evidence sections when there is none', () => {
    const evidence: KnowledgeNodeEvidence = {
      node: makeNode({ description: null }),
      countsBySourceType: {},
      evidence: [],
      relatedNodes: [],
      confidence: 0,
    }

    const markdown = buildKnowledgeExportMarkdown(evidence)

    expect(markdown).not.toContain('## Related Concepts')
    expect(markdown).not.toContain('## Evidence')
    expect(markdown).toContain('_No description recorded._')
  })
})

describe('knowledgeExportFilename', () => {
  it('slugifies a title into a lowercase-hyphenated .md filename', () => {
    expect(knowledgeExportFilename('Mtoni River Lodge')).toBe('mtoni-river-lodge.md')
  })

  it('strips punctuation and collapses repeated separators', () => {
    expect(knowledgeExportFilename('Q1 2026: Revenue & Growth!')).toBe('q1-2026-revenue-growth.md')
  })

  it('falls back to a default name for an empty/unslugifiable title', () => {
    expect(knowledgeExportFilename('***')).toBe('knowledge-export.md')
  })
})
