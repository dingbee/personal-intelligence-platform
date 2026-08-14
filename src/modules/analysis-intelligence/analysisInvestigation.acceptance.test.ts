import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/analysis-intelligence/module'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'
import { EXPECTED, PRODUCT_SALES_DATA_ROWS, PRODUCT_SALES_ROWS } from '@/modules/data-intelligence/__fixtures__/productSalesWorkbook'
import type { StructuredDataset } from '@/modules/data-intelligence/api/structuredDatasets'
import type { CellValue } from '@/modules/processing/spreadsheet/types'

const { getStructuredDatasetMock, getChatProviderMock, streamChatCompletionMock, hasFeatureMock } = vi.hoisted(() => ({
  getStructuredDatasetMock: vi.fn(),
  getChatProviderMock: vi.fn(),
  streamChatCompletionMock: vi.fn(),
  hasFeatureMock: vi.fn(),
}))

vi.mock('@/modules/data-intelligence/api/structuredDatasets', () => ({ getStructuredDataset: getStructuredDatasetMock }))
vi.mock('@/modules/ai/providers/registry', () => ({ getChatProvider: getChatProviderMock, DEFAULT_CHAT_PROVIDER_ID: 'anthropic' }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))
vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))

import { runAnalysisInvestigation } from '@/modules/analysis-intelligence/api/runAnalysisInvestigation'
import { analysisInvestigationToProvenance } from '@/shared/provenance/adapters/analysisIntelligenceAdapter'
import { resolveEvidenceChain, toLookup } from '@/shared/provenance/resolveEvidenceChain'

/**
 * Analysis Intelligence — benchmark acceptance test, run against the SAME
 * Product Sales fixture the Data Intelligence benchmark uses (preserved
 * unmodified — see executeAnalyticalPlan.acceptance.test.ts). This tests
 * "can ARRIYIA investigate the question responsibly" at the deterministic
 * layer: the step-planner's AI calls are mocked with realistic,
 * hand-written plans (simulating what a well-behaved planner would
 * propose for this question), and every number produced is verified
 * either against EXPECTED (independently computed, never via this
 * engine) or via cross-step internal consistency — the same discipline
 * executeAnalyticalPlan.acceptance.test.ts already established. Narrative
 * quality (evidence-grounding, causal-restraint scoring per the
 * architecture audit §23) requires a live model and is out of scope for
 * this deterministic environment — see the final report's Benchmark
 * section for what remains unverified without live LLM access.
 */
function buildDataset(): StructuredDataset {
  const analysis = analyzeSheet(PRODUCT_SALES_ROWS, 0, 'Sales')
  return {
    id: 'benchmark-dataset',
    documentId: 'benchmark-document',
    userId: 'pro-user',
    workspaceId: 'workspace-1',
    sheetIndex: 0,
    sheetName: 'Sales',
    columns: analysis.columns,
    rows: PRODUCT_SALES_DATA_ROWS as CellValue[][],
    rowCount: PRODUCT_SALES_DATA_ROWS.length,
    columnCount: analysis.columns.length,
  }
}

function jsonResponse(obj: unknown) {
  return { content: JSON.stringify(obj), model: 'test-model' }
}

describe('Analysis Intelligence benchmark — Product Sales investigation scenarios', () => {
  const dataset = buildDataset()

  beforeEach(() => {
    vi.resetAllMocks()
    getStructuredDatasetMock.mockResolvedValue(dataset)
    getChatProviderMock.mockReturnValue({ id: 'anthropic' })
    hasFeatureMock.mockResolvedValue(true)
  })

  it('Investigation: "Why does Carol have a higher return rate than other salespeople?" — baseline, then a consistent follow-up breakdown', async () => {
    // Step 1: a well-behaved planner's baseline computation — return rate by salesperson.
    streamChatCompletionMock.mockResolvedValueOnce(
      jsonResponse({
        purpose: 'baseline: return rate by salesperson',
        hypothesis: null,
        plan: {
          dimensions: [{ column: 'Salesperson' }],
          measures: [{ as: 'returnRate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count', filters: [{ column: 'Returned', op: 'eq', value: true }] }, denominator: { aggregation: 'count' } } }],
        },
      }),
    )
    // Step 2: follow-up scoped to Carol specifically, breaking her orders down by whether they were returned.
    streamChatCompletionMock.mockResolvedValueOnce(
      jsonResponse({
        purpose: "follow-up: Carol's own orders, by return status",
        hypothesis: "Carol's higher rate may not be explained by a single dimension without further breakdown",
        plan: {
          filters: [{ column: 'Salesperson', op: 'eq', value: 'Carol' }],
          dimensions: [{ column: 'Returned' }],
          measures: [{ as: 'orderCount', aggregation: 'count' }],
        },
      }),
    )
    streamChatCompletionMock.mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'Baseline and confirming breakdown both established; further dimensions available on request.' }))
    streamChatCompletionMock.mockResolvedValueOnce({
      content: "Carol's observed return rate (40%) is higher than Alice's and Bob's (20% each) in this dataset. This is an observed association, not a demonstrated cause.",
      model: 'm',
    })

    const { investigation } = await runAnalysisInvestigation({
      datasetId: dataset.id,
      question: 'Why does Carol have a higher return rate than other salespeople?',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
    })

    expect(investigation.status).toBe('complete')
    expect(investigation.steps).toHaveLength(2)

    // Step 1 — verified against EXPECTED (independently computed, see productSalesWorkbook.ts).
    const step1 = investigation.steps[0]!
    expect(step1.result.status).toBe('ok')
    const step1RatesBySalesperson = step1.result.status === 'ok' ? Object.fromEntries(step1.result.rows.map((r) => [r.dimensions.Salesperson, r.measures.returnRate])) : {}
    expect(step1RatesBySalesperson.Alice).toBeCloseTo(EXPECTED.returnRateBySalesperson.Alice, 10)
    expect(step1RatesBySalesperson.Bob).toBeCloseTo(EXPECTED.returnRateBySalesperson.Bob, 10)
    expect(step1RatesBySalesperson.Carol).toBeCloseTo(EXPECTED.returnRateBySalesperson.Carol, 10)

    // Step 2 — cross-checked against step 1: Carol's true/(true+false) order-count ratio must equal her step-1 return rate exactly, a genuine agreement between two independently-executed deterministic plans.
    const step2 = investigation.steps[1]!
    expect(step2.result.status).toBe('ok')
    const counts = step2.result.status === 'ok' ? Object.fromEntries(step2.result.rows.map((r) => [String(r.dimensions.Returned), r.measures.orderCount ?? 0])) : {}
    const returnedCount = counts.true ?? 0
    const totalCount = (counts.true ?? 0) + (counts.false ?? 0)
    expect(returnedCount / totalCount).toBeCloseTo(EXPECTED.returnRateBySalesperson.Carol, 10)

    // Every observation traces back to a real sheet/provenance, never fabricated.
    for (const step of investigation.steps) {
      for (const observation of step.observations) {
        expect(observation.provenance.sheetName).toBe('Sales')
        expect(observation.provenance.documentId).toBe('benchmark-document')
      }
    }

    // Provenance Foundation — the same observations remain traceable through the shared model, all the way back to the real dataset, without changing any of the numbers above.
    const chain = analysisInvestigationToProvenance(investigation)
    const synthesisDerivation = chain.derivations.find((d) => d.kind === 'synthesis')!
    const resolved = resolveEvidenceChain(synthesisDerivation.id, toLookup(chain))!
    expect(resolved.priorDerivations.length).toBeGreaterThan(0)
    for (const observationNode of resolved.priorDerivations) {
      expect(observationNode.priorDerivations[0]!.evidence[0]!.source).toEqual({ type: 'dataset', id: 'benchmark-document', title: 'Sales' })
    }

    // Synthesis is grounded in the computed numbers and explicitly declines to assert causation.
    expect(investigation.synthesis).toContain('40%')
    expect(investigation.synthesis?.toLowerCase()).toContain('not a demonstrated cause')
    expect(investigation.contradictions).toEqual([])
  })

  it('Investigation: a question with no relevant column is declined honestly, never guessed at', async () => {
    streamChatCompletionMock.mockResolvedValueOnce(jsonResponse({ error: 'This dataset has no column describing customer satisfaction or sentiment.' }))

    const { investigation } = await runAnalysisInvestigation({
      datasetId: dataset.id,
      question: 'What is customer sentiment about our products?',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
    })

    expect(investigation.status).toBe('declined')
    expect(investigation.steps).toHaveLength(0)
    expect(investigation.synthesis).toBeNull()
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('Investigation that never naturally stops is truncated at the hard step limit and still synthesizes what was established, explicitly flagged as limited', async () => {
    let callCount = 0
    streamChatCompletionMock.mockImplementation(async () => {
      callCount += 1
      if (callCount <= 5) {
        return jsonResponse({
          purpose: `exploratory step ${callCount}`,
          hypothesis: null,
          plan: { dimensions: [{ column: 'Region' }], measures: [{ as: 'total', aggregation: 'sum', column: 'Total Price' }] },
        })
      }
      return { content: 'Investigation depth was limited before a natural stopping point was reached.', model: 'm' }
    })

    const { investigation } = await runAnalysisInvestigation({
      datasetId: dataset.id,
      question: 'Explore everything about regional sales.',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
    })

    expect(investigation.steps).toHaveLength(5)
    expect(investigation.stepLimitReached).toBe(true)
    expect(investigation.status).toBe('complete')
    expect(investigation.synthesis).toContain('limited')
  })
})
