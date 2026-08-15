import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ResearchInvestigation, ResearchStep } from '@/modules/research-intelligence/researchInvestigation'

const { createIntelligenceRecordMock } = vi.hoisted(() => ({
  createIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/intelligence-ledger/api/createIntelligenceRecord', () => ({ createIntelligenceRecord: createIntelligenceRecordMock }))

import { recordResearchIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordResearchIntelligenceRecord'

function realStep(overrides: Partial<ResearchStep> = {}): ResearchStep {
  return {
    id: 'step-1',
    index: 0,
    kind: 'evidence_gathering',
    purpose: 'baseline evidence gathering',
    triggeredBy: null,
    query: 'What changed in Q3 pricing feedback?',
    evidence: [{ id: 'evidence-1', source: { type: 'document', id: 'document-1', title: 'Q3 feedback digest' }, excerpt: 'Several customers asked for usage-based pricing.', similarity: 0.82 }],
    observations: [{ id: 'observation-1', stepId: 'step-1', statement: 'Multiple customers requested usage-based pricing in Q3.', evidenceIds: ['evidence-1'] }],
    datasetInvestigation: null,
    ...overrides,
  }
}

function realInvestigation(overrides: Partial<ResearchInvestigation> = {}): ResearchInvestigation {
  return {
    id: 'investigation-1',
    question: 'What do customers want from pricing changes?',
    scope: null,
    context: null,
    workspaceId: 'workspace-1',
    documentId: null,
    steps: [realStep()],
    hypotheses: [],
    comparisons: [],
    gaps: [],
    keyFindings: ['Customers want usage-based pricing.'],
    synthesis: 'Customer feedback points toward usage-based pricing.',
    limitations: null,
    followUpQuestions: [],
    status: 'complete',
    stepLimitReached: false,
    budgetExhausted: false,
    declineReason: null,
    ...overrides,
  } as ResearchInvestigation
}

describe('recordResearchIntelligenceRecord', () => {
  beforeEach(() => createIntelligenceRecordMock.mockReset())

  it('persists a real ResearchInvestigation through the actual researchIntelligenceAdapter', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordResearchIntelligenceRecord({ investigation: realInvestigation(), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        recordType: 'research',
        summary: 'Research Intelligence: What do customers want from pricing changes?',
        operationId: 'operation-1',
        providerId: 'openai',
      }),
    )

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.provenance.evidence).toEqual([{ id: 'evidence-1', source: { type: 'document', id: 'document-1', title: 'Q3 feedback digest' }, location: { kind: 'whole' }, excerpt: 'Several customers asked for usage-based pricing.', retrievedAt: null }])
    expect(call.provenance.derivations).toHaveLength(2)
    expect(call.provenance.derivations[0]).toMatchObject({ kind: 'observation', evidenceIds: ['evidence-1'] })
    expect(call.provenance.derivations[1]).toMatchObject({ kind: 'synthesis', statement: 'Customer feedback points toward usage-based pricing.' })
  })

  it('is called unconditionally from the engine (unlike Analysis, which gates on parentOperation) — writeIntelligenceRecord always receives a well-formed provenance chain', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordResearchIntelligenceRecord({ investigation: realInvestigation(), workspaceId: null, operationId: 'operation-1', providerId: null })

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.workspaceId).toBeNull()
    expect(call.providerId).toBeNull()
    expect(call.provenance.evidence.length).toBeGreaterThan(0)
  })

  it('a step that found nothing contributes no evidence — never fabricated', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })
    const investigation = realInvestigation({ steps: [realStep({ evidence: [], observations: [] })], synthesis: null })

    await recordResearchIntelligenceRecord({ investigation, workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.provenance.evidence).toEqual([])
    expect(call.provenance.derivations).toEqual([])
  })

  it('a dataset_investigation step splices in the nested Analysis provenance chain — a real Data -> Analysis -> Research trace', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })
    const nestedStep = {
      id: 'analysis-step-1',
      index: 0,
      purpose: 'baseline',
      triggeredBy: null,
      plan: { datasetId: 'dataset-1', measures: [{ as: 'total_revenue', aggregation: 'sum' as const, column: 'revenue' }] },
      result: {
        status: 'ok' as const,
        plan: { datasetId: 'dataset-1', measures: [{ as: 'total_revenue', aggregation: 'sum' as const, column: 'revenue' }] },
        rows: [{ dimensions: {}, measures: { total_revenue: 12000 } }],
        provenance: { documentId: 'dataset-1', sheetName: 'Q3 Sales', sheetIndex: 0, totalRowsInDataset: 500, rowsMatchedAfterFilters: 500 },
      },
      observations: [],
    }
    const investigation = realInvestigation({
      steps: [
        realStep({
          kind: 'dataset_investigation',
          evidence: [],
          observations: [{ id: 'observation-1', stepId: 'step-1', statement: 'Q3 revenue was 12000.', evidenceIds: [] }],
          datasetInvestigation: {
            id: 'analysis-investigation-1',
            question: 'What was Q3 revenue?',
            datasetId: 'dataset-1',
            steps: [nestedStep],
            hypotheses: [],
            contradictions: [],
            synthesis: null,
            status: 'complete',
            stepLimitReached: false,
            budgetExhausted: false,
            declineReason: null,
          },
        }),
      ],
    })

    await recordResearchIntelligenceRecord({ investigation, workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    // The nested Data Intelligence evidence/calculation is present, spliced in via analysisIntelligenceAdapter.
    expect(call.provenance.evidence).toEqual([{ id: 'data:dataset-1:0', source: { type: 'dataset', id: 'dataset-1', title: 'Q3 Sales' }, location: { kind: 'rows', sheetName: 'Q3 Sales', sheetIndex: 0, rowCount: 500 }, excerpt: null, retrievedAt: null }])
    expect(call.provenance.derivations.some((d: { kind: string }) => d.kind === 'calculation')).toBe(true)
  })
})
