import { describe, expect, it } from 'vitest'
import { buildKnowledgeTimeline } from '@/modules/evolution/knowledgeEvolution/knowledgeTimeline'
import type { Cluster } from '@/modules/knowledge/intelligence/conceptClusters'

const NOW = new Date('2026-07-29T00:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

function cluster(overrides: Partial<Cluster> & { id: string; nodeIds: string[] }): Cluster {
  return { label: overrides.id, size: overrides.nodeIds.length, density: 1, ...overrides }
}

describe('buildKnowledgeTimeline', () => {
  it('produces one event per document', () => {
    const events = buildKnowledgeTimeline({
      documents: [{ id: 'd1', title: 'Report', created_at: daysAgo(1) }],
      notes: [],
      concepts: [],
      clusters: [],
      now: NOW,
    })
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('document_added')
    expect(events[0]!.description).toContain('Report')
  })

  it('produces one event per note, falling back to "Untitled note"', () => {
    const events = buildKnowledgeTimeline({
      documents: [],
      notes: [{ id: 'n1', title: '', created_at: daysAgo(1) }],
      concepts: [],
      clusters: [],
      now: NOW,
    })
    expect(events[0]!.description).toContain('Untitled note')
  })

  it('describes a widely-spanning cluster as having evolved over time', () => {
    const events = buildKnowledgeTimeline({
      documents: [],
      notes: [],
      concepts: [
        { id: 'a', title: 'AI Ethics', created_at: daysAgo(60) },
        { id: 'b', title: 'Bias', created_at: daysAgo(5) },
      ],
      clusters: [cluster({ id: 'c1', label: 'AI Ethics', nodeIds: ['a', 'b'] })],
      now: NOW,
    })
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('cluster_evolved')
    expect(events[0]!.description).toContain('evolved over')
  })

  it('describes a tightly-formed cluster as emerging rather than evolving', () => {
    const events = buildKnowledgeTimeline({
      documents: [],
      notes: [],
      concepts: [
        { id: 'a', title: 'AI Ethics', created_at: daysAgo(1) },
        { id: 'b', title: 'Bias', created_at: daysAgo(1) },
      ],
      clusters: [cluster({ id: 'c1', label: 'AI Ethics', nodeIds: ['a', 'b'] })],
      now: NOW,
    })
    expect(events[0]!.description).toContain('emerged')
  })

  it('anchors a cluster event to its most recent member timestamp', () => {
    const events = buildKnowledgeTimeline({
      documents: [],
      notes: [],
      concepts: [
        { id: 'a', title: 'AI Ethics', created_at: daysAgo(60) },
        { id: 'b', title: 'Bias', created_at: daysAgo(5) },
      ],
      clusters: [cluster({ id: 'c1', label: 'AI Ethics', nodeIds: ['a', 'b'] })],
      now: NOW,
    })
    expect(events[0]!.date).toBe(daysAgo(5))
  })

  it('reports concepts outside any cluster as individually emerged', () => {
    const events = buildKnowledgeTimeline({
      documents: [],
      notes: [],
      concepts: [{ id: 'a', title: 'Solo Concept', created_at: daysAgo(1) }],
      clusters: [],
      now: NOW,
    })
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('concept_emerged')
  })

  it('does not double-count a concept that is both clustered and in the concepts list', () => {
    const events = buildKnowledgeTimeline({
      documents: [],
      notes: [],
      concepts: [
        { id: 'a', title: 'A', created_at: daysAgo(1) },
        { id: 'b', title: 'B', created_at: daysAgo(1) },
      ],
      clusters: [cluster({ id: 'c1', label: 'A', nodeIds: ['a', 'b'] })],
      now: NOW,
    })
    expect(events.filter((e) => e.type === 'concept_emerged')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'cluster_evolved')).toHaveLength(1)
  })

  it('skips clusters below the minimum size for a timeline entry', () => {
    const events = buildKnowledgeTimeline({
      documents: [],
      notes: [],
      concepts: [{ id: 'a', title: 'A', created_at: daysAgo(1) }],
      clusters: [cluster({ id: 'c1', label: 'A', nodeIds: ['a'] })],
      now: NOW,
    })
    expect(events[0]!.type).toBe('concept_emerged')
  })

  it('sorts events most-recent-first', () => {
    const events = buildKnowledgeTimeline({
      documents: [{ id: 'd1', title: 'Old', created_at: daysAgo(30) }],
      notes: [{ id: 'n1', title: 'New', created_at: daysAgo(1) }],
      concepts: [],
      clusters: [],
      now: NOW,
    })
    expect(events[0]!.description).toContain('New')
    expect(events[1]!.description).toContain('Old')
  })

  it('excludes events dated in the future relative to now', () => {
    const future = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const events = buildKnowledgeTimeline({
      documents: [{ id: 'd1', title: 'Future Doc', created_at: future }],
      notes: [],
      concepts: [],
      clusters: [],
      now: NOW,
    })
    expect(events).toHaveLength(0)
  })

  it('returns an empty timeline for an empty workspace', () => {
    const events = buildKnowledgeTimeline({ documents: [], notes: [], concepts: [], clusters: [], now: NOW })
    expect(events).toHaveLength(0)
  })
})
