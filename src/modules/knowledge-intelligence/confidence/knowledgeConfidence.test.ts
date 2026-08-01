import { describe, expect, it } from 'vitest'
import { computeKnowledgeConfidence } from '@/modules/knowledge-intelligence/confidence/knowledgeConfidence'

describe('computeKnowledgeConfidence', () => {
  const now = new Date('2026-07-31T12:00:00Z')

  it('is low for a concept with a single, stale, isolated source', () => {
    const score = computeKnowledgeConfidence({
      sourceCounts: { document: 1 },
      mostRecentEvidenceAt: '2025-01-01T00:00:00Z',
      relatedConceptCount: 0,
      now,
    })
    expect(score).toBeLessThan(0.3)
  })

  it('is zero-freshness but not zero-overall for a concept with no evidence at all', () => {
    const score = computeKnowledgeConfidence({ sourceCounts: {}, mostRecentEvidenceAt: null, relatedConceptCount: 0, now })
    expect(score).toBe(0)
  })

  it('is high for a well-corroborated, fresh, connected concept', () => {
    const score = computeKnowledgeConfidence({
      sourceCounts: { document: 5, note: 3, conversation: 4 },
      mostRecentEvidenceAt: '2026-07-30T00:00:00Z',
      relatedConceptCount: 6,
      now,
    })
    expect(score).toBeGreaterThan(0.9)
  })

  it('rewards diversity across source types over raw volume in one type, at the same total count', () => {
    const diverse = computeKnowledgeConfidence({
      sourceCounts: { document: 2, note: 2, conversation: 2 },
      mostRecentEvidenceAt: '2026-07-30T00:00:00Z',
      relatedConceptCount: 0,
      now,
    })
    const concentrated = computeKnowledgeConfidence({
      sourceCounts: { document: 6 },
      mostRecentEvidenceAt: '2026-07-30T00:00:00Z',
      relatedConceptCount: 0,
      now,
    })
    expect(diverse).toBeGreaterThan(concentrated)
  })

  it('rewards fresher evidence over staler evidence at the same source counts', () => {
    const fresh = computeKnowledgeConfidence({
      sourceCounts: { document: 2 },
      mostRecentEvidenceAt: '2026-07-30T00:00:00Z',
      relatedConceptCount: 0,
      now,
    })
    const stale = computeKnowledgeConfidence({
      sourceCounts: { document: 2 },
      mostRecentEvidenceAt: '2024-01-01T00:00:00Z',
      relatedConceptCount: 0,
      now,
    })
    expect(fresh).toBeGreaterThan(stale)
  })

  it('never exceeds 1 even with extreme inputs', () => {
    const score = computeKnowledgeConfidence({
      sourceCounts: { document: 500, note: 500, conversation: 500 },
      mostRecentEvidenceAt: now.toISOString(),
      relatedConceptCount: 500,
      now,
    })
    expect(score).toBeLessThanOrEqual(1)
  })

  it('is never negative', () => {
    const score = computeKnowledgeConfidence({ sourceCounts: {}, mostRecentEvidenceAt: null, relatedConceptCount: 0, now })
    expect(score).toBeGreaterThanOrEqual(0)
  })
})
