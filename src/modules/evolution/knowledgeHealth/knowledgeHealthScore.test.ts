import { describe, expect, it } from 'vitest'
import { computeKnowledgeHealth } from '@/modules/evolution/knowledgeHealth/knowledgeHealthScore'
import type { AiMemory, DocumentRow, KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

const NOW = new Date('2026-07-29T00:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

function concept(id: string, title = id): KnowledgeNode {
  return {
    id,
    user_id: 'u1',
    workspace_id: 'w1',
    node_type: 'concept',
    title,
    title_normalized: title.toLowerCase(),
    description: null,
    source_type: 'document',
    source_id: 'doc1',
    source_chunk_ids: null,
    generation_metadata: null,
    metadata: null,
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
  }
}

function edge(sourceId: string, targetId: string): KnowledgeLink {
  return {
    id: `${sourceId}-${targetId}`,
    user_id: 'u1',
    workspace_id: 'w1',
    source_type: 'knowledge_node',
    source_id: sourceId,
    target_type: 'knowledge_node',
    target_id: targetId,
    created_at: daysAgo(10),
    relationship_type: null,
    confidence: null,
    generated_by: 'ai:detect-relationships',
    metadata: null,
  }
}

function document(id: string, overrides: Partial<{ status: DocumentRow['status']; updated_at: string; hasReadingProgress: boolean }> = {}) {
  return { id, status: 'ready' as DocumentRow['status'], updated_at: daysAgo(1), hasReadingProgress: true, ...overrides }
}

function memory(id: string, overrides: Partial<AiMemory> = {}): AiMemory {
  return {
    id,
    user_id: 'u1',
    workspace_id: 'w1',
    memory_type: 'learned_preference',
    content: 'x',
    source: null,
    is_active: true,
    created_at: daysAgo(30),
    updated_at: daysAgo(1),
    ...overrides,
  }
}

describe('computeKnowledgeHealth', () => {
  it('returns a perfect score with no issues for a clean workspace', () => {
    const report = computeKnowledgeHealth({
      concepts: [concept('a'), concept('b')],
      edges: [edge('a', 'b')],
      documents: [document('d1')],
      memories: [memory('m1')],
      workspaceLastActivityAt: daysAgo(1),
      now: NOW,
    })
    expect(report.score).toBe(100)
    expect(report.issues).toHaveLength(0)
  })

  it('penalizes orphaned concepts', () => {
    const report = computeKnowledgeHealth({
      concepts: [concept('a'), concept('b')],
      edges: [],
      documents: [],
      memories: [],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.score).toBeLessThan(100)
    expect(report.issues.some((i) => i.type === 'orphaned_concepts' && i.count === 2)).toBe(true)
  })

  it('penalizes duplicate concepts', () => {
    const report = computeKnowledgeHealth({
      concepts: [concept('a', 'Machine Learning Basics'), concept('b', 'Machine Learning Basics Extended')],
      edges: [],
      documents: [],
      memories: [],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.issues.some((i) => i.type === 'duplicate_concepts' && i.count === 1)).toBe(true)
  })

  it('penalizes stale documents that were never re-visited', () => {
    const report = computeKnowledgeHealth({
      concepts: [],
      edges: [],
      documents: [document('d1', { updated_at: daysAgo(200), hasReadingProgress: false })],
      memories: [],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.issues.some((i) => i.type === 'stale_documents' && i.count === 1)).toBe(true)
  })

  it('does not count a stale document that has reading progress', () => {
    const report = computeKnowledgeHealth({
      concepts: [],
      edges: [],
      documents: [document('d1', { updated_at: daysAgo(200), hasReadingProgress: true })],
      memories: [],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.issues.some((i) => i.type === 'stale_documents')).toBe(false)
  })

  it('penalizes unread documents', () => {
    const report = computeKnowledgeHealth({
      concepts: [],
      edges: [],
      documents: [document('d1', { hasReadingProgress: false })],
      memories: [],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.issues.some((i) => i.type === 'unread_documents' && i.count === 1)).toBe(true)
  })

  it('ignores non-ready documents entirely', () => {
    const report = computeKnowledgeHealth({
      concepts: [],
      edges: [],
      documents: [document('d1', { status: 'processing', hasReadingProgress: false, updated_at: daysAgo(200) })],
      memories: [],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.issues.some((i) => i.type === 'unread_documents' || i.type === 'stale_documents')).toBe(false)
  })

  it('penalizes stale active memories', () => {
    const report = computeKnowledgeHealth({
      concepts: [],
      edges: [],
      documents: [],
      memories: [memory('m1', { updated_at: daysAgo(200) })],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.issues.some((i) => i.type === 'stale_memories' && i.count === 1)).toBe(true)
  })

  it('does not count an inactive (soft-deleted) memory as stale', () => {
    const report = computeKnowledgeHealth({
      concepts: [],
      edges: [],
      documents: [],
      memories: [memory('m1', { updated_at: daysAgo(200), is_active: false })],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.issues.some((i) => i.type === 'stale_memories')).toBe(false)
  })

  it('penalizes an inactive workspace', () => {
    const report = computeKnowledgeHealth({
      concepts: [],
      edges: [],
      documents: [],
      memories: [],
      workspaceLastActivityAt: daysAgo(100),
      now: NOW,
    })
    expect(report.issues.some((i) => i.type === 'inactive_workspace')).toBe(true)
  })

  it('never returns a score below 0', () => {
    const concepts = Array.from({ length: 10 }, (_, i) => concept(`c${i}`))
    const report = computeKnowledgeHealth({
      concepts,
      edges: [],
      documents: Array.from({ length: 10 }, (_, i) => document(`d${i}`, { updated_at: daysAgo(200), hasReadingProgress: false })),
      memories: Array.from({ length: 10 }, (_, i) => memory(`m${i}`, { updated_at: daysAgo(200) })),
      workspaceLastActivityAt: daysAgo(200),
      now: NOW,
    })
    expect(report.score).toBeGreaterThanOrEqual(0)
  })

  it('handles an entirely empty workspace without throwing', () => {
    const report = computeKnowledgeHealth({
      concepts: [],
      edges: [],
      documents: [],
      memories: [],
      workspaceLastActivityAt: null,
      now: NOW,
    })
    expect(report.score).toBe(100)
    expect(report.issues).toHaveLength(0)
  })
})
