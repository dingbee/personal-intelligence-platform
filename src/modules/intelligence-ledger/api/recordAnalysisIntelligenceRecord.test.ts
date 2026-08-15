import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AnalysisInvestigation, AnalysisStep, Observation } from '@/modules/analysis-intelligence/analysisInvestigation'
import type { AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

const { createIntelligenceRecordMock } = vi.hoisted(() => ({
  createIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/intelligence-ledger/api/createIntelligenceRecord', () => ({ createIntelligenceRecord: createIntelligenceRecordMock }))

import { recordAnalysisIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordAnalysisIntelligenceRecord'

// A real, ok-status AnalyticalResult — the same shape executeAnalyticalPlan.ts (Data Intelligence) actually returns.
function okResult(): AnalyticalResult {
  return {
    status: 'ok',
    plan: { datasetId: 'dataset-1', measures: [{ as: 'total_revenue', aggregation: 'sum', column: 'revenue' }] },
    rows: [{ dimensions: {}, measures: { total_revenue: 12000 } }],
    provenance: { documentId: 'dataset-1', sheetName: 'Q3 Sales', sheetIndex: 0, totalRowsInDataset: 500, rowsMatchedAfterFilters: 500 },
  }
}

function realObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: 'observation-1',
    stepId: 'step-1',
    statement: 'Total Q3 revenue was 12000.',
    value: 12000,
    provenance: { documentId: 'dataset-1', sheetName: 'Q3 Sales', sheetIndex: 0, totalRowsInDataset: 500, rowsMatchedAfterFilters: 500 },
    ...overrides,
  }
}

function realStep(overrides: Partial<AnalysisStep> = {}): AnalysisStep {
  return {
    id: 'step-1',
    index: 0,
    purpose: 'baseline',
    triggeredBy: null,
    plan: okResult().plan,
    result: okResult(),
    observations: [realObservation()],
    ...overrides,
  }
}

function realInvestigation(overrides: Partial<AnalysisInvestigation> = {}): AnalysisInvestigation {
  return {
    id: 'investigation-1',
    question: 'How did Q3 revenue compare to Q2?',
    datasetId: 'dataset-1',
    steps: [realStep()],
    hypotheses: [],
    contradictions: [],
    synthesis: 'Q3 revenue grew relative to Q2.',
    status: 'complete',
    stepLimitReached: false,
    budgetExhausted: false,
    declineReason: null,
    ...overrides,
  }
}

describe('recordAnalysisIntelligenceRecord', () => {
  beforeEach(() => createIntelligenceRecordMock.mockReset())

  it('persists a real AnalysisInvestigation through the actual analysisIntelligenceAdapter (which itself reuses the Data Intelligence adapter)', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordAnalysisIntelligenceRecord({ investigation: realInvestigation(), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        recordType: 'analysis',
        summary: 'Analysis Intelligence: How did Q3 revenue compare to Q2?',
        operationId: 'operation-1',
        providerId: 'openai',
      }),
    )

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    // Data Intelligence's own evidence/calculation, spliced in by the Analysis adapter, plus one observation and one closing synthesis.
    expect(call.provenance.evidence).toEqual([{ id: 'data:dataset-1:0', source: { type: 'dataset', id: 'dataset-1', title: 'Q3 Sales' }, location: { kind: 'rows', sheetName: 'Q3 Sales', sheetIndex: 0, rowCount: 500 }, excerpt: null, retrievedAt: null }])
    expect(call.provenance.derivations).toHaveLength(3)
    expect(call.provenance.derivations[0]).toMatchObject({ kind: 'calculation', id: 'data:dataset-1:0:calc' })
    expect(call.provenance.derivations[1]).toMatchObject({ kind: 'observation', evidenceIds: ['data:dataset-1:0'], basedOnDerivationIds: ['data:dataset-1:0:calc'] })
    expect(call.provenance.derivations[2]).toMatchObject({ kind: 'synthesis', statement: 'Q3 revenue grew relative to Q2.' })
  })

  it('a failed (status:error) step contributes nothing — never a fabricated evidence/derivation for a validation error', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })
    const failedResult: AnalyticalResult = { status: 'error', plan: okResult().plan, error: { code: 'unknown_column', message: 'no such column' } }
    const investigation = realInvestigation({ steps: [realStep({ result: failedResult, observations: [] })], synthesis: null })

    await recordAnalysisIntelligenceRecord({ investigation, workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.provenance.evidence).toEqual([])
    expect(call.provenance.derivations).toEqual([])
  })

  it('a synthesis with no observation derivations to base itself on contributes no closing synthesis derivation', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })
    const investigation = realInvestigation({ steps: [realStep({ observations: [] })] })

    await recordAnalysisIntelligenceRecord({ investigation, workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.provenance.derivations.some((d: { kind: string }) => d.kind === 'synthesis')).toBe(false)
  })
})
