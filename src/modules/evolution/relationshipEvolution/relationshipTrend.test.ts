import { describe, expect, it } from 'vitest'
import { computeRelationshipEvolution } from '@/modules/evolution/relationshipEvolution/relationshipTrend'
import type { KnowledgeLink } from '@/shared/types/database'

const NOW = new Date('2026-07-29T00:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

function link(overrides: Partial<KnowledgeLink> & { id: string }): KnowledgeLink {
  return {
    user_id: 'u1',
    workspace_id: 'w1',
    source_type: 'knowledge_node',
    source_id: 'a',
    target_type: 'knowledge_node',
    target_id: 'b',
    created_at: daysAgo(1),
    relationship_type: null,
    confidence: null,
    generated_by: 'ai:detect-relationships',
    metadata: null,
    ...overrides,
  }
}

describe('computeRelationshipEvolution', () => {
  it('only counts AI-generated edges', () => {
    const edges = [link({ id: '1', generated_by: null }), link({ id: '2' })]
    const result = computeRelationshipEvolution(edges, NOW)
    expect(result.allTime).toBe(1)
  })

  it('buckets counts into 7/30/all-time windows', () => {
    const edges = [
      link({ id: '1', created_at: daysAgo(1) }),
      link({ id: '2', created_at: daysAgo(20) }),
      link({ id: '3', created_at: daysAgo(100) }),
    ]
    const result = computeRelationshipEvolution(edges, NOW)
    expect(result.last7Days).toBe(1)
    expect(result.last30Days).toBe(2)
    expect(result.allTime).toBe(3)
  })

  it('picks the most common relationship_type among recent edges', () => {
    const edges = [
      link({ id: '1', created_at: daysAgo(1), relationship_type: 'supports' }),
      link({ id: '2', created_at: daysAgo(2), relationship_type: 'supports' }),
      link({ id: '3', created_at: daysAgo(3), relationship_type: 'contradicts' }),
    ]
    const result = computeRelationshipEvolution(edges, NOW)
    expect(result.topRelationshipType).toBe('supports')
  })

  it('returns null topRelationshipType when nothing is typed', () => {
    const edges = [link({ id: '1', relationship_type: null })]
    const result = computeRelationshipEvolution(edges, NOW)
    expect(result.topRelationshipType).toBeNull()
  })

  it('ignores relationship types from edges outside the 30-day window', () => {
    const edges = [link({ id: '1', created_at: daysAgo(100), relationship_type: 'supports' })]
    const result = computeRelationshipEvolution(edges, NOW)
    expect(result.topRelationshipType).toBeNull()
  })

  it('returns a stable direction with no edges at all', () => {
    const result = computeRelationshipEvolution([], NOW)
    expect(result.direction).toBe('stable')
    expect(result.allTime).toBe(0)
  })

  it('returns an up direction when recent growth outpaces the baseline', () => {
    const edges = Array.from({ length: 5 }, (_, i) => link({ id: `${i}`, created_at: daysAgo(i) }))
    const result = computeRelationshipEvolution(edges, NOW)
    expect(result.direction).toBe('up')
  })
})
