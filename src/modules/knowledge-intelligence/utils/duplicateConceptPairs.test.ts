import { describe, expect, it } from 'vitest'
import { findDuplicateConceptPairs } from '@/modules/knowledge-intelligence/utils/duplicateConceptPairs'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

function node(id: string, title: string, nodeType: KnowledgeNode['node_type'] = 'concept'): KnowledgeNode {
  return {
    id,
    user_id: 'u1',
    workspace_id: 'w1',
    node_type: nodeType,
    title,
    title_normalized: title.toLowerCase(),
    description: null,
    source_type: 'document',
    source_id: 'doc1',
    source_chunk_ids: null,
    generation_metadata: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function edge(sourceId: string, targetId: string, generatedBy: string | null = 'ai:detect-relationships'): KnowledgeLink {
  return {
    id: `${sourceId}-${targetId}`,
    user_id: 'u1',
    workspace_id: 'w1',
    source_type: 'knowledge_node',
    source_id: sourceId,
    target_type: 'knowledge_node',
    target_id: targetId,
    created_at: '2026-01-01T00:00:00.000Z',
    relationship_type: null,
    confidence: null,
    generated_by: generatedBy,
    metadata: null,
  }
}

describe('findDuplicateConceptPairs', () => {
  it('flags two concepts with highly overlapping but non-identical normalized titles', () => {
    const nodes = [node('a', 'Machine Learning Basics'), node('b', 'Machine Learning Basics Guide')]
    expect(findDuplicateConceptPairs(nodes, [])).toHaveLength(1)
  })

  it('does not flag titles that are identical once normalized (already merged by resolveCanonicalNode)', () => {
    const nodes = [node('a', 'Machine Learning Basics'), node('b', 'Machine Learning Basics!')]
    expect(findDuplicateConceptPairs(nodes, [])).toHaveLength(0)
  })

  it('does not flag concepts of different types', () => {
    const nodes = [node('a', 'Machine Learning Basics', 'concept'), node('b', 'Machine Learning Basics Guide', 'entity')]
    expect(findDuplicateConceptPairs(nodes, [])).toHaveLength(0)
  })

  it('does not flag concepts already directly connected', () => {
    const nodes = [node('a', 'Machine Learning Basics'), node('b', 'Machine Learning Basics Guide')]
    expect(findDuplicateConceptPairs(nodes, [edge('a', 'b')])).toHaveLength(0)
  })

  it('ignores non-AI-generated edges when checking for an existing connection', () => {
    const nodes = [node('a', 'Machine Learning Basics'), node('b', 'Machine Learning Basics Guide')]
    expect(findDuplicateConceptPairs(nodes, [edge('a', 'b', null)])).toHaveLength(1)
  })

  it('does not flag unrelated titles', () => {
    const nodes = [node('a', 'Machine Learning'), node('b', 'Renaissance Art')]
    expect(findDuplicateConceptPairs(nodes, [])).toHaveLength(0)
  })

  it('returns multiple pairs when several unrelated duplicate pairs exist', () => {
    const nodes = [
      node('a', 'Machine Learning Basics'),
      node('b', 'Machine Learning Basics Extended'),
      node('c', 'Renaissance Art History'),
      node('d', 'Renaissance Art History Extended'),
    ]
    expect(findDuplicateConceptPairs(nodes, [])).toHaveLength(2)
  })
})
