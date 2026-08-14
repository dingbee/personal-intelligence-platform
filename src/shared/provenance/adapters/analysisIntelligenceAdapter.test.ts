import { describe, expect, it } from 'vitest'
import { analysisInvestigationToProvenance } from '@/shared/provenance/adapters/analysisIntelligenceAdapter'
import { resolveEvidenceChain, toLookup } from '@/shared/provenance/resolveEvidenceChain'
import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'
import type { AnalyticalProvenance } from '@/modules/data-intelligence/analyticalPlan'

const provenance: AnalyticalProvenance = { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 30, rowsMatchedAfterFilters: 6 }

function investigation(overrides: Partial<AnalysisInvestigation> = {}): AnalysisInvestigation {
  return {
    id: 'inv-1',
    question: 'Why is South high?',
    datasetId: 'dataset-1',
    steps: [
      {
        id: 'step-1',
        index: 0,
        purpose: 'baseline',
        triggeredBy: null,
        plan: { datasetId: 'dataset-1', dimensions: [{ column: 'Region' }], measures: [{ as: 'rate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count' }, denominator: { aggregation: 'count' } } }] },
        result: { status: 'ok', plan: { datasetId: 'dataset-1', measures: [] }, rows: [{ dimensions: { Region: 'South' }, measures: { rate: 0.26 } }], provenance },
        observations: [{ id: 'obs-1', stepId: 'step-1', statement: 'Region=South — rate=0.26', value: 0.26, provenance }],
      },
    ],
    hypotheses: [],
    contradictions: [],
    synthesis: 'South shows a higher observed rate.',
    status: 'complete',
    stepLimitReached: false,
    budgetExhausted: false,
    declineReason: null,
    ...overrides,
  }
}

describe('analysisInvestigationToProvenance', () => {
  it('reuses the Data Intelligence adapter per step and chains observations -> calculation -> synthesis', () => {
    const chain = analysisInvestigationToProvenance(investigation())

    expect(chain.evidence).toHaveLength(1)
    expect(chain.derivations.map((d) => d.kind)).toEqual(['calculation', 'observation', 'synthesis'])

    const synthesis = chain.derivations.find((d) => d.kind === 'synthesis')!
    const resolved = resolveEvidenceChain(synthesis.id, toLookup(chain))!
    expect(resolved.priorDerivations).toHaveLength(1)
    expect(resolved.priorDerivations[0]!.derivation.statement).toBe('Region=South — rate=0.26')
    expect(resolved.priorDerivations[0]!.priorDerivations[0]!.evidence[0]!.source.type).toBe('dataset')
  })

  it('produces no synthesis derivation when there is no synthesis prose yet', () => {
    const chain = analysisInvestigationToProvenance(investigation({ synthesis: null, status: 'in_progress' }))
    expect(chain.derivations.some((d) => d.kind === 'synthesis')).toBe(false)
  })

  it('a step with a failed result contributes nothing — mirrors the engine\'s own "never fabricate" rule', () => {
    const failedStep = investigation().steps[0]!
    const chain = analysisInvestigationToProvenance(
      investigation({
        steps: [{ ...failedStep, result: { status: 'error', plan: failedStep.plan, error: { code: 'unknown_column', message: 'x' } }, observations: [] }],
        synthesis: null,
      }),
    )
    expect(chain.evidence).toEqual([])
    expect(chain.derivations).toEqual([])
  })
})
