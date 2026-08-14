import { describe, expect, it } from 'vitest'
import { formatResearchForSynthesis, collectDistinctSources } from '@/modules/research-intelligence/api/formatResearchForSynthesis'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'

function baseInvestigation(overrides: Partial<ResearchInvestigation> = {}): ResearchInvestigation {
  return {
    id: 'inv-1',
    question: 'Why are regional returns different?',
    scope: 'Q3 only',
    context: null,
    workspaceId: 'workspace-1',
    documentId: null,
    steps: [],
    hypotheses: [],
    comparisons: [],
    gaps: [],
    keyFindings: [],
    synthesis: null,
    limitations: null,
    followUpQuestions: [],
    status: 'in_progress',
    stepLimitReached: false,
    budgetExhausted: false,
    synthesisFailed: false,
    declineReason: null,
    ...overrides,
  }
}

describe('collectDistinctSources', () => {
  it('de-duplicates the same source appearing across multiple steps', () => {
    const investigation = baseInvestigation({
      steps: [
        {
          id: 's1', index: 0, kind: 'evidence_gathering', purpose: 'p', triggeredBy: null, query: 'q1', datasetInvestigation: null,
          evidence: [{ id: 'e1', source: { type: 'document', id: 'doc-1', title: 'Policy' }, excerpt: 'x', similarity: 0.9 }],
          observations: [],
        },
        {
          id: 's2', index: 1, kind: 'evidence_gathering', purpose: 'p2', triggeredBy: 's1', query: 'q2', datasetInvestigation: null,
          evidence: [{ id: 'e2', source: { type: 'document', id: 'doc-1', title: 'Policy' }, excerpt: 'y', similarity: 0.8 }],
          observations: [],
        },
      ],
    })
    expect(collectDistinctSources(investigation)).toHaveLength(1)
  })
})

describe('formatResearchForSynthesis', () => {
  it('includes question, scope, context, and per-step evidence with numbered source references', () => {
    const investigation = baseInvestigation({
      steps: [
        {
          id: 's1', index: 0, kind: 'evidence_gathering', purpose: 'baseline', triggeredBy: null, query: 'return policy', datasetInvestigation: null,
          evidence: [{ id: 'e1', source: { type: 'document', id: 'doc-1', title: 'Returns Policy' }, excerpt: '30-day window applies.', similarity: 0.9 }],
          observations: [{ id: 'o1', stepId: 's1', statement: 'A 30-day return window applies.', evidenceIds: ['e1'] }],
        },
      ],
    })

    const text = formatResearchForSynthesis(investigation)
    expect(text).toContain('Why are regional returns different?')
    expect(text).toContain('Q3 only')
    expect(text).toContain('[Source 1: Returns Policy]')
    expect(text).toContain('30-day window applies.')
    expect(text).toContain('A 30-day return window applies.')
  })

  it('reports "No evidence found" for a step that found nothing', () => {
    const investigation = baseInvestigation({
      steps: [{ id: 's1', index: 0, kind: 'evidence_gathering', purpose: 'p', triggeredBy: null, query: 'q', evidence: [], observations: [], datasetInvestigation: null }],
    })
    expect(formatResearchForSynthesis(investigation)).toContain('No evidence found for this step.')
  })
})
