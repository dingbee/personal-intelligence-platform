import { describe, expect, it } from 'vitest'
import { computeConceptEvolution } from '@/modules/evolution/conceptEvolution/conceptTrend'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

const NOW = new Date('2026-07-29T00:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

function node(overrides: Partial<KnowledgeNode> & { id: string }): KnowledgeNode {
  return {
    user_id: 'u1',
    workspace_id: 'w1',
    node_type: 'concept',
    title: overrides.id,
    title_normalized: overrides.id,
    description: null,
    source_type: 'document',
    source_id: 'doc1',
    source_chunk_ids: null,
    generation_metadata: null,
    metadata: null,
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
    ...overrides,
  }
}

function edge(overrides: Partial<KnowledgeLink> & { source_id: string; target_id: string }): KnowledgeLink {
  return {
    id: `${overrides.source_id}-${overrides.target_id}`,
    user_id: 'u1',
    workspace_id: 'w1',
    source_type: 'knowledge_node',
    target_type: 'knowledge_node',
    created_at: daysAgo(10),
    relationship_type: null,
    confidence: null,
    generated_by: 'ai:detect-relationships',
    metadata: null,
    ...overrides,
  }
}

describe('computeConceptEvolution', () => {
  it('marks a brand-new concept with a single source as emerging', () => {
    const n = node({ id: 'a', created_at: daysAgo(2), updated_at: daysAgo(2) })
    const result = computeConceptEvolution({
      nodes: [n],
      edges: [],
      sourceEvents: [{ nodeId: 'a', createdAt: daysAgo(2) }],
      now: NOW,
    })
    expect(result[0]!.status).toBe('emerging')
  })

  it('marks an older concept that just gained a new source as growing', () => {
    const n = node({ id: 'a', created_at: daysAgo(60), updated_at: daysAgo(1) })
    const result = computeConceptEvolution({
      nodes: [n],
      edges: [],
      sourceEvents: [
        { nodeId: 'a', createdAt: daysAgo(60) },
        { nodeId: 'a', createdAt: daysAgo(1) },
      ],
      now: NOW,
    })
    expect(result[0]!.status).toBe('growing')
  })

  it('marks a concept untouched for a long time as dormant', () => {
    const n = node({ id: 'a', created_at: daysAgo(200), updated_at: daysAgo(100) })
    const result = computeConceptEvolution({
      nodes: [n],
      edges: [],
      sourceEvents: [{ nodeId: 'a', createdAt: daysAgo(200) }],
      now: NOW,
    })
    expect(result[0]!.status).toBe('dormant')
  })

  it('marks a concept with recent-but-unremarkable activity as stable', () => {
    const n = node({ id: 'a', created_at: daysAgo(200), updated_at: daysAgo(20) })
    const result = computeConceptEvolution({
      nodes: [n],
      edges: [],
      sourceEvents: [{ nodeId: 'a', createdAt: daysAgo(200) }],
      now: NOW,
    })
    expect(result[0]!.status).toBe('stable')
  })

  it('computes degree only from AI-generated edges touching the node', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })]
    const edges = [edge({ source_id: 'a', target_id: 'b' }), edge({ source_id: 'a', target_id: 'c', generated_by: null })]
    const result = computeConceptEvolution({ nodes, edges, sourceEvents: [], now: NOW })
    expect(result.find((r) => r.nodeId === 'a')!.degree).toBe(1)
    expect(result.find((r) => r.nodeId === 'b')!.degree).toBe(1)
    expect(result.find((r) => r.nodeId === 'c')!.degree).toBe(0)
  })

  it('ignores edges referencing nodes outside the given set', () => {
    const nodes = [node({ id: 'a' })]
    const edges = [edge({ source_id: 'a', target_id: 'ghost' })]
    const result = computeConceptEvolution({ nodes, edges, sourceEvents: [], now: NOW })
    expect(result[0]!.degree).toBe(0)
  })

  it('counts only recent source events within the recency window', () => {
    const n = node({ id: 'a', created_at: daysAgo(200) })
    const result = computeConceptEvolution({
      nodes: [n],
      edges: [],
      sourceEvents: [
        { nodeId: 'a', createdAt: daysAgo(1) },
        { nodeId: 'a', createdAt: daysAgo(100) },
      ],
      now: NOW,
    })
    expect(result[0]!.sourceCountTotal).toBe(2)
    expect(result[0]!.sourceCountRecent).toBe(1)
  })

  it('returns one entry per node, preserving title', () => {
    const nodes = [node({ id: 'a', title: 'Alpha' }), node({ id: 'b', title: 'Beta' })]
    const result = computeConceptEvolution({ nodes, edges: [], sourceEvents: [], now: NOW })
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.title).sort()).toEqual(['Alpha', 'Beta'])
  })
})
