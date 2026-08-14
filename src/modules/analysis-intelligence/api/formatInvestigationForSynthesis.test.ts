import { describe, expect, it } from 'vitest'
import { formatInvestigationForSynthesis } from '@/modules/analysis-intelligence/api/formatInvestigationForSynthesis'
import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'
import type { AnalyticalPlan, AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

const plan: AnalyticalPlan = { datasetId: 'ds-1', measures: [{ as: 'rate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count' }, denominator: { aggregation: 'count' } } }] }
const provenance = { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 30, rowsMatchedAfterFilters: 30 }
const okResult: AnalyticalResult = { status: 'ok', plan, rows: [{ dimensions: {}, measures: { rate: 0.26 } }], provenance }
const errorResult: AnalyticalResult = { status: 'error', plan, error: { code: 'unknown_column', message: 'Column "Foo" does not exist.' } }

function baseInvestigation(overrides: Partial<AnalysisInvestigation> = {}): AnalysisInvestigation {
  return {
    id: 'inv-1',
    question: 'Why is South high?',
    datasetId: 'ds-1',
    steps: [],
    hypotheses: [],
    contradictions: [],
    synthesis: null,
    status: 'in_progress',
    stepLimitReached: false,
    declineReason: null,
    ...overrides,
  }
}

describe('formatInvestigationForSynthesis', () => {
  it('includes the original question and each step\'s purpose and observations', () => {
    const investigation = baseInvestigation({
      steps: [{ id: 's1', index: 0, purpose: 'baseline', triggeredBy: null, plan, result: okResult, observations: [{ id: 'o1', stepId: 's1', statement: 'South rate: 0.26', value: 0.26, provenance }] }],
    })
    const text = formatInvestigationForSynthesis(investigation)
    expect(text).toContain('Why is South high?')
    expect(text).toContain('baseline')
    expect(text).toContain('South rate: 0.26')
  })

  it('marks a failed step plainly, without inventing observations for it', () => {
    const investigation = baseInvestigation({
      steps: [{ id: 's1', index: 0, purpose: 'follow-up', triggeredBy: null, plan, result: errorResult, observations: [] }],
    })
    const text = formatInvestigationForSynthesis(investigation)
    expect(text).toContain('FAILED')
    expect(text).toContain('Column "Foo" does not exist.')
  })

  it('lists hypotheses with their status, and explicitly says "none proposed" when empty', () => {
    expect(formatInvestigationForSynthesis(baseInvestigation())).toContain('None proposed.')
    const withHypothesis = baseInvestigation({ hypotheses: [{ id: 'h1', statement: 'Product mix may explain it', supportingObservationIds: [], status: 'untested' }] })
    const text = formatInvestigationForSynthesis(withHypothesis)
    expect(text).toContain('Product mix may explain it')
    expect(text).toContain('[untested]')
  })

  it('includes a step-limit note only when stepLimitReached is true', () => {
    expect(formatInvestigationForSynthesis(baseInvestigation({ stepLimitReached: false }))).not.toContain('maximum step limit')
    expect(formatInvestigationForSynthesis(baseInvestigation({ stepLimitReached: true }))).toContain('maximum step limit')
  })

  it('lists contradictions when present', () => {
    const investigation = baseInvestigation({ contradictions: [{ id: 'c1', observationIds: ['o1', 'o2'], description: 'Sales rose while volume fell.' }] })
    expect(formatInvestigationForSynthesis(investigation)).toContain('Sales rose while volume fell.')
  })
})
