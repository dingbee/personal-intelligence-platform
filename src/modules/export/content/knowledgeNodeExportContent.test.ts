import { describe, expect, it } from 'vitest'
import { buildKnowledgeNodeExportContent } from '@/modules/export/content/knowledgeNodeExportContent'
import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { KnowledgeNode } from '@/shared/types/database'

function fakeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: 'How plants make food.',
    source_type: 'document',
    source_id: 'doc-1',
    source_chunk_ids: ['chunk-1'],
    generation_metadata: { capability: 'extract-knowledge' },
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakeEvidence(overrides: Partial<KnowledgeNodeEvidence> = {}): KnowledgeNodeEvidence {
  return {
    node: fakeNode(),
    countsBySourceType: { document: 1 },
    evidence: [{ type: 'document', id: 'doc-1', label: 'Field Notes', createdAt: '2026-01-02T00:00:00.000Z' }],
    relatedNodes: [
      { nodeId: 'node-2', title: 'Chlorophyll', relationshipType: 'requires', confidence: 0.9, relationshipConfidence: { relationship: 0.9, evidenceCount: 0, sources: [] } },
    ],
    confidence: 0.82,
    ...overrides,
  }
}

describe('buildKnowledgeNodeExportContent', () => {
  it('carries the title, description, and confidence subtitle', () => {
    const content = buildKnowledgeNodeExportContent(fakeEvidence())
    expect(content.title).toBe('Photosynthesis')
    expect(content.subtitle).toBe('Concept · Knowledge Confidence: 82%')
    expect(content.sections[0]!.body).toEqual(['How plants make food.'])
  })

  it('labels an entity distinctly from a concept', () => {
    const content = buildKnowledgeNodeExportContent(fakeEvidence({ node: fakeNode({ node_type: 'entity' }) }))
    expect(content.subtitle).toContain('Entity')
  })

  it('includes a Related Concepts list section when related nodes exist', () => {
    const content = buildKnowledgeNodeExportContent(fakeEvidence())
    const section = content.sections.find((s) => s.heading === 'Related Concepts')
    expect(section).toBeDefined()
    expect(section!.format).toBe('list')
    expect(section!.body).toEqual(['Chlorophyll (requires)'])
  })

  it('omits the Related Concepts section when there are none', () => {
    const content = buildKnowledgeNodeExportContent(fakeEvidence({ relatedNodes: [] }))
    expect(content.sections.some((s) => s.heading === 'Related Concepts')).toBe(false)
  })

  it('groups evidence by source type into its own section', () => {
    const content = buildKnowledgeNodeExportContent(fakeEvidence())
    const section = content.sections.find((s) => s.heading === 'Evidence — Documents')
    expect(section).toBeDefined()
    expect(section!.body[0]).toContain('Field Notes')
  })

  it('never carries node/source ids, source_chunk_ids, or generation_metadata', () => {
    const content = buildKnowledgeNodeExportContent(fakeEvidence())
    const serialized = JSON.stringify(content)
    expect(serialized).not.toContain('node-1')
    expect(serialized).not.toContain('node-2')
    expect(serialized).not.toContain('doc-1')
    expect(serialized).not.toContain('chunk-1')
    expect(serialized).not.toContain('capability')
  })
})
