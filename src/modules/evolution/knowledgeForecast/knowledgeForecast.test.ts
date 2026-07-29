import { describe, expect, it } from 'vitest'
import { computeKnowledgeForecasts } from '@/modules/evolution/knowledgeForecast/knowledgeForecast'
import type { ConceptEvolution } from '@/modules/evolution/conceptEvolution/conceptTrend'
import type { RelationshipEvolution } from '@/modules/evolution/relationshipEvolution/relationshipTrend'

function concept(overrides: Partial<ConceptEvolution> & { nodeId: string }): ConceptEvolution {
  return {
    title: overrides.nodeId,
    status: 'stable',
    sourceCountTotal: 1,
    sourceCountRecent: 0,
    degree: 0,
    ageDays: 30,
    daysSinceLastActivity: 1,
    ...overrides,
  }
}

const STABLE_RELATIONSHIPS: RelationshipEvolution = {
  last7Days: 0,
  last30Days: 0,
  allTime: 0,
  topRelationshipType: null,
  direction: 'stable',
}

describe('computeKnowledgeForecasts', () => {
  it('forecasts inactivity for a declining workspace', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'declining',
      concepts: [],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [],
    })
    expect(forecasts.some((f) => f.message.includes('likely become inactive'))).toBe(true)
  })

  it('forecasts slowdown risk for a stagnant workspace', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'stagnant',
      concepts: [],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [],
    })
    expect(forecasts.some((f) => f.message.includes('slowing down'))).toBe(true)
  })

  it('does not forecast inactivity for a growing workspace', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'growing',
      concepts: [],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [],
    })
    expect(forecasts.some((f) => f.message.includes('inactive'))).toBe(false)
  })

  it('forecasts a rising central topic from the strongest qualifying concept', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'active',
      concepts: [
        concept({ nodeId: 'a', title: 'AI Ethics', sourceCountRecent: 3, degree: 4 }),
        concept({ nodeId: 'b', title: 'Minor Topic', sourceCountRecent: 0, degree: 0 }),
      ],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [],
    })
    expect(forecasts.some((f) => f.message.includes('"AI Ethics" is becoming a central topic'))).toBe(true)
  })

  it('does not forecast a central topic when no concept qualifies', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'active',
      concepts: [concept({ nodeId: 'a', sourceCountRecent: 0, degree: 0 })],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [],
    })
    expect(forecasts.some((f) => f.message.includes('central topic'))).toBe(false)
  })

  it('forecasts slowing relationship growth', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'active',
      concepts: [],
      relationships: { ...STABLE_RELATIONSHIPS, allTime: 10, direction: 'down' },
      healthIssues: [],
    })
    expect(forecasts.some((f) => f.message.includes('slowing down'))).toBe(true)
  })

  it('forecasts accelerating relationship growth', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'active',
      concepts: [],
      relationships: { ...STABLE_RELATIONSHIPS, allTime: 10, direction: 'up' },
      healthIssues: [],
    })
    expect(forecasts.some((f) => f.message.includes('connecting concepts faster'))).toBe(true)
  })

  it('forecasts stale-document risk only above the count threshold', () => {
    const below = computeKnowledgeForecasts({
      maturityStage: 'active',
      concepts: [],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [{ type: 'stale_documents', message: '', count: 1 }],
    })
    const above = computeKnowledgeForecasts({
      maturityStage: 'active',
      concepts: [],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [{ type: 'stale_documents', message: '', count: 5 }],
    })
    expect(below.some((f) => f.message.includes('risk going stale'))).toBe(false)
    expect(above.some((f) => f.message.includes('risk going stale'))).toBe(true)
  })

  it('forecasts a duplication warning when duplicate concepts exist', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'active',
      concepts: [],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [{ type: 'duplicate_concepts', message: '', count: 1 }],
    })
    expect(forecasts.some((f) => f.message.includes('duplicated'))).toBe(true)
  })

  it('returns an empty list when nothing warrants a forecast', () => {
    const forecasts = computeKnowledgeForecasts({
      maturityStage: 'active',
      concepts: [],
      relationships: STABLE_RELATIONSHIPS,
      healthIssues: [],
    })
    expect(forecasts).toHaveLength(0)
  })
})
