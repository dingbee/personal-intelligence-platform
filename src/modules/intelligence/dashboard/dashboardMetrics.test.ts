import { describe, expect, it } from 'vitest'
import { computeKnowledgeGrowth, computeIntelligenceScore, type GrowthMetric } from '@/modules/intelligence/dashboard/dashboardMetrics'

const NOW = new Date('2026-07-29T00:00:00.000Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function emptyGrowthInput() {
  return {
    documents: [],
    notes: [],
    concepts: [],
    connections: [],
    chatRequests: [],
    insightArtifacts: [],
    readingProgressUpdates: [],
    now: NOW,
  }
}

describe('computeKnowledgeGrowth', () => {
  it('returns all seven metric types even with no data', () => {
    const growth = computeKnowledgeGrowth(emptyGrowthInput())
    expect(growth).toHaveLength(7)
    expect(growth.every((m) => m.last7Days === 0 && m.last30Days === 0 && m.allTime === 0)).toBe(true)
  })

  it('buckets documents into 7-day, 30-day, and all-time windows correctly', () => {
    const growth = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      documents: [{ created_at: daysAgo(2) }, { created_at: daysAgo(20) }, { created_at: daysAgo(60) }],
    })
    const documents = growth.find((m) => m.type === 'documents_added')!
    expect(documents.last7Days).toBe(1)
    expect(documents.last30Days).toBe(2)
    expect(documents.allTime).toBe(3)
  })

  it('counts notes, concepts, and connections independently', () => {
    const growth = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      notes: [{ created_at: daysAgo(1) }],
      concepts: [{ created_at: daysAgo(1) }, { created_at: daysAgo(1) }],
      connections: [{ created_at: daysAgo(1) }],
    })
    expect(growth.find((m) => m.type === 'notes_created')!.last7Days).toBe(1)
    expect(growth.find((m) => m.type === 'concepts_discovered')!.last7Days).toBe(2)
    expect(growth.find((m) => m.type === 'connections_formed')!.last7Days).toBe(1)
  })

  it('counts chat requests as questions asked', () => {
    const growth = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      chatRequests: [{ created_at: daysAgo(1) }, { created_at: daysAgo(1) }],
    })
    expect(growth.find((m) => m.type === 'questions_asked')!.last7Days).toBe(2)
  })

  it('counts insight artifacts (chapter summaries + flashcards combined)', () => {
    const growth = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      insightArtifacts: [{ created_at: daysAgo(1) }, { created_at: daysAgo(1) }, { created_at: daysAgo(1) }],
    })
    expect(growth.find((m) => m.type === 'insights_generated')!.last7Days).toBe(3)
  })

  it('counts reading progress updates using updated_at', () => {
    const growth = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      readingProgressUpdates: [{ updated_at: daysAgo(3) }],
    })
    expect(growth.find((m) => m.type === 'reading_progress_updates')!.last7Days).toBe(1)
  })

  it('excludes items older than 30 days from all windows except all-time', () => {
    const growth = computeKnowledgeGrowth({ ...emptyGrowthInput(), documents: [{ created_at: daysAgo(45) }] })
    const documents = growth.find((m) => m.type === 'documents_added')!
    expect(documents.last7Days).toBe(0)
    expect(documents.last30Days).toBe(0)
    expect(documents.allTime).toBe(1)
  })

  it('includes an item exactly at the 7-day boundary', () => {
    const growth = computeKnowledgeGrowth({ ...emptyGrowthInput(), documents: [{ created_at: daysAgo(7) }] })
    expect(growth.find((m) => m.type === 'documents_added')!.last7Days).toBe(1)
  })

  it('gives every metric a human-readable label', () => {
    const growth = computeKnowledgeGrowth(emptyGrowthInput())
    expect(growth.every((m) => typeof m.label === 'string' && m.label.length > 0)).toBe(true)
  })

  it('all-time count is always at least as large as the 30-day count, which is at least as large as the 7-day count', () => {
    const growth = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      notes: [{ created_at: daysAgo(1) }, { created_at: daysAgo(15) }, { created_at: daysAgo(60) }],
    })
    const notes = growth.find((m) => m.type === 'notes_created')!
    expect(notes.allTime).toBeGreaterThanOrEqual(notes.last30Days)
    expect(notes.last30Days).toBeGreaterThanOrEqual(notes.last7Days)
  })
})

function baseScoreInput() {
  return {
    growth: computeKnowledgeGrowth({ ...emptyGrowthInput() }),
    totalMemories: 0,
    activeMemories: 0,
    contradictoryMemoryPairCount: 0,
    connectedConceptCount: 0,
    totalConceptCount: 0,
    organizedDocumentCount: 0,
    totalDocumentCount: 0,
  }
}

describe('computeIntelligenceScore', () => {
  it('returns exactly the five documented categories', () => {
    const scores = computeIntelligenceScore(baseScoreInput())
    expect(scores.map((s) => s.category)).toEqual([
      'knowledge_growth',
      'memory_quality',
      'learning_momentum',
      'knowledge_connectivity',
      'information_organization',
    ])
  })

  it('gives every score an explanation string', () => {
    const scores = computeIntelligenceScore(baseScoreInput())
    expect(scores.every((s) => typeof s.explanation === 'string' && s.explanation.length > 0)).toBe(true)
  })

  it('keeps every score value within 0-100', () => {
    const growth: GrowthMetric[] = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      documents: Array.from({ length: 100 }, () => ({ created_at: daysAgo(1) })),
    })
    const scores = computeIntelligenceScore({ ...baseScoreInput(), growth })
    expect(scores.every((s) => s.value >= 0 && s.value <= 100)).toBe(true)
  })

  it('scores memory quality as 100 with no memories at all', () => {
    const scores = computeIntelligenceScore(baseScoreInput())
    expect(scores.find((s) => s.category === 'memory_quality')!.value).toBe(100)
  })

  it('lowers memory quality score for inactive memories', () => {
    const scores = computeIntelligenceScore({ ...baseScoreInput(), totalMemories: 10, activeMemories: 5 })
    expect(scores.find((s) => s.category === 'memory_quality')!.value).toBe(50)
  })

  it('penalizes memory quality score for contradictions', () => {
    const withContradiction = computeIntelligenceScore({
      ...baseScoreInput(),
      totalMemories: 10,
      activeMemories: 10,
      contradictoryMemoryPairCount: 1,
    })
    const without = computeIntelligenceScore({ ...baseScoreInput(), totalMemories: 10, activeMemories: 10 })
    expect(withContradiction.find((s) => s.category === 'memory_quality')!.value).toBeLessThan(
      without.find((s) => s.category === 'memory_quality')!.value,
    )
  })

  it('scores knowledge connectivity as 0 with no concepts at all', () => {
    const scores = computeIntelligenceScore(baseScoreInput())
    expect(scores.find((s) => s.category === 'knowledge_connectivity')!.value).toBe(0)
  })

  it('scores knowledge connectivity from the connected/total ratio', () => {
    const scores = computeIntelligenceScore({ ...baseScoreInput(), connectedConceptCount: 3, totalConceptCount: 6 })
    expect(scores.find((s) => s.category === 'knowledge_connectivity')!.value).toBe(50)
  })

  it('scores information organization as 100 with no documents at all', () => {
    const scores = computeIntelligenceScore(baseScoreInput())
    expect(scores.find((s) => s.category === 'information_organization')!.value).toBe(100)
  })

  it('scores information organization from the organized/total ratio', () => {
    const scores = computeIntelligenceScore({ ...baseScoreInput(), organizedDocumentCount: 2, totalDocumentCount: 4 })
    expect(scores.find((s) => s.category === 'information_organization')!.value).toBe(50)
  })

  it('scores learning momentum from reading activity in the last 7 days', () => {
    const growth = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      readingProgressUpdates: [{ updated_at: daysAgo(1) }, { updated_at: daysAgo(2) }, { updated_at: daysAgo(3) }],
    })
    const scores = computeIntelligenceScore({ ...baseScoreInput(), growth })
    expect(scores.find((s) => s.category === 'learning_momentum')!.value).toBe(100)
  })

  it('reports an up trend for knowledge growth when this week outpaces the 30-day average', () => {
    const growth = computeKnowledgeGrowth({
      ...emptyGrowthInput(),
      documents: [{ created_at: daysAgo(1) }, { created_at: daysAgo(2) }, { created_at: daysAgo(3) }, { created_at: daysAgo(4) }],
    })
    const scores = computeIntelligenceScore({ ...baseScoreInput(), growth })
    expect(scores.find((s) => s.category === 'knowledge_growth')!.trend).toBe('up')
  })

  it('reports a null trend for knowledge growth when there is no 30-day baseline', () => {
    const scores = computeIntelligenceScore(baseScoreInput())
    expect(scores.find((s) => s.category === 'knowledge_growth')!.trend).toBeNull()
  })

  it('never reports a trend for memory quality, knowledge connectivity, or information organization (no historical baseline exists)', () => {
    const scores = computeIntelligenceScore(baseScoreInput())
    expect(scores.find((s) => s.category === 'memory_quality')!.trend).toBeNull()
    expect(scores.find((s) => s.category === 'knowledge_connectivity')!.trend).toBeNull()
    expect(scores.find((s) => s.category === 'information_organization')!.trend).toBeNull()
  })
})
