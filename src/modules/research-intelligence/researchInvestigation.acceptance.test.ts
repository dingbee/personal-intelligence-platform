import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/analysis-intelligence/module'
import '@/modules/research-intelligence/module'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'
import { EXPECTED, PRODUCT_SALES_DATA_ROWS, PRODUCT_SALES_ROWS } from '@/modules/data-intelligence/__fixtures__/productSalesWorkbook'
import type { StructuredDataset } from '@/modules/data-intelligence/api/structuredDatasets'
import type { CellValue } from '@/modules/processing/spreadsheet/types'

const { getStructuredDatasetMock, listStructuredDatasetsForDocumentMock, getChatProviderMock, streamChatCompletionMock, hasFeatureMock, gatherEvidenceMock } = vi.hoisted(() => ({
  getStructuredDatasetMock: vi.fn(),
  listStructuredDatasetsForDocumentMock: vi.fn(),
  getChatProviderMock: vi.fn(),
  streamChatCompletionMock: vi.fn(),
  hasFeatureMock: vi.fn(),
  gatherEvidenceMock: vi.fn(),
}))

vi.mock('@/modules/data-intelligence/api/structuredDatasets', () => ({
  getStructuredDataset: getStructuredDatasetMock,
  listStructuredDatasetsForDocument: listStructuredDatasetsForDocumentMock,
}))
vi.mock('@/modules/ai/providers/registry', () => ({ getChatProvider: getChatProviderMock, DEFAULT_CHAT_PROVIDER_ID: 'anthropic' }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))
vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))
vi.mock('@/modules/research-intelligence/gatherEvidence', () => ({ gatherEvidence: gatherEvidenceMock }))

import { runResearchInvestigation } from '@/modules/research-intelligence/api/runResearchInvestigation'

/**
 * Research Intelligence — benchmark acceptance test, per the P2 brief's
 * required scenarios. Two independent things are verified end-to-end,
 * with nothing fabricated in either:
 *
 * 1. Data/Analysis Intelligence integration — reuses the SAME Product
 *    Sales fixture the Data Intelligence and Analysis Intelligence
 *    benchmarks already use (preserved unmodified), running the REAL
 *    executeAnalyticalPlan and the REAL runAnalysisInvestigation
 *    orchestration underneath a mocked step-planner/synthesis AI layer
 *    that simulates a well-behaved planner. Every number is verified
 *    against EXPECTED (independently computed, never via this engine).
 *
 * 2. Multi-source evidence synthesis — the P2 brief's "add a small
 *    controlled multi-source benchmark ... must preserve source
 *    identity and attribution ... do not use fabricated test citations"
 *    requirement. Since the architecture audit confirmed no external
 *    web/URL source mechanism exists anywhere in this codebase (see the
 *    final report's Architecture Audited section), this scenario uses
 *    two controlled INTERNAL sources — a document chunk and a note,
 *    exactly the shape gatherEvidence.ts really returns from
 *    retrieveContext/retrieveNoteContext — rather than a fabricated
 *    external citation (a URL, an academic study, a named publication)
 *    that this system has no way to have actually retrieved.
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

describe('Research Intelligence benchmark scenarios', () => {
  const dataset = buildDataset()

  beforeEach(() => {
    vi.resetAllMocks()
    getStructuredDatasetMock.mockResolvedValue(dataset)
    listStructuredDatasetsForDocumentMock.mockResolvedValue([{ id: dataset.id, sheetIndex: 0, sheetName: 'Sales', rowCount: dataset.rowCount, columnCount: dataset.columnCount }])
    getChatProviderMock.mockReturnValue({ id: 'anthropic' })
    hasFeatureMock.mockResolvedValue(true)
    gatherEvidenceMock.mockResolvedValue([])
  })

  it('"Why does Carol have a higher return rate than other salespeople?" — delegates to a real, verified Analysis Investigation over the Product Sales fixture', async () => {
    streamChatCompletionMock
      // Research step planner: chooses to delegate to the dataset.
      .mockResolvedValueOnce(jsonResponse({ action: 'analyze_dataset', purpose: 'quantify the pattern', subQuestion: 'Why does Carol have a higher return rate than other salespeople?' }))
      // Analysis Intelligence's own step planner (real runAnalysisInvestigation running underneath).
      .mockResolvedValueOnce(
        jsonResponse({
          purpose: 'baseline: return rate by salesperson',
          hypothesis: null,
          plan: { dimensions: [{ column: 'Salesperson' }], measures: [{ as: 'returnRate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count', filters: [{ column: 'Returned', op: 'eq', value: true }] }, denominator: { aggregation: 'count' } } }] },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'baseline established' }))
      // Analysis Intelligence's synthesis (its own registered capability).
      .mockResolvedValueOnce({ content: "Carol's observed return rate (40%) is higher than Alice's and Bob's (20% each). This is an observed association, not a demonstrated cause.", model: 'm' })
      // Research step planner: stop after the dataset delegation.
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'the dataset delegation established the pattern' }))
      // Research synthesis.
      .mockResolvedValueOnce(
        jsonResponse({
          synthesis: "Carol's return rate is materially higher than her peers', per a verified breakdown of the sales dataset.",
          keyFindings: ["Carol's return rate is 40%, versus 20% for Alice and Bob."],
          limitations: 'Only salesperson-level breakdown was computed; no causal driver was established.',
          comparisons: [],
          gaps: [{ description: 'What specifically differs about Carol\'s orders was not investigated further.', reason: 'unanswered_question' }],
          followUpQuestions: ['What products or regions account for the difference in Carol\'s return rate?'],
        }),
      )

    const { investigation } = await runResearchInvestigation({
      question: 'Why does Carol have a higher return rate than other salespeople?',
      documentId: 'benchmark-document',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
    })

    expect(investigation.status).toBe('complete')
    expect(investigation.steps).toHaveLength(1)
    const step = investigation.steps[0]!
    expect(step.kind).toBe('dataset_investigation')

    // The underlying AnalysisInvestigation's own numbers are real and independently verified — never recomputed by Research Intelligence.
    const analysisStep = step.datasetInvestigation!.steps[0]!
    expect(analysisStep.result.status).toBe('ok')
    const ratesBySalesperson = analysisStep.result.status === 'ok' ? Object.fromEntries(analysisStep.result.rows.map((r) => [r.dimensions.Salesperson, r.measures.returnRate])) : {}
    expect(ratesBySalesperson.Carol).toBeCloseTo(EXPECTED.returnRateBySalesperson.Carol, 10)
    expect(ratesBySalesperson.Alice).toBeCloseTo(EXPECTED.returnRateBySalesperson.Alice, 10)

    // The research observation carried forward states the same real, deterministically-formatted number, not a re-derived one.
    expect(step.observations.some((o) => o.statement.includes('Carol') && o.statement.includes(String(EXPECTED.returnRateBySalesperson.Carol)))).toBe(true)

    expect(investigation.keyFindings[0]).toContain('40%')
    expect(investigation.gaps).toHaveLength(1)
    expect(investigation.gaps[0]!.reason).toBe('unanswered_question')
    expect(investigation.followUpQuestions).toHaveLength(1)
  })

  it('multi-source scenario: two controlled internal sources (a document and a note) are compared honestly, with source identity preserved and no fabricated citation', async () => {
    const documentEvidence = {
      id: 'chunk-1',
      source: { type: 'document' as const, id: 'doc-returns-policy', title: 'Returns Policy 2024' },
      excerpt: 'Orders receiving a discount above 10% show a higher observed return rate in Q3 2024 data.',
      similarity: 0.92,
    }
    const noteEvidence = {
      id: 'note-1',
      source: { type: 'note' as const, id: 'note-ops-review', title: 'Ops review notes' },
      excerpt: 'Manual audit of Q3 2024 discounted orders found no clear single cause for the elevated return rate.',
      similarity: 0.81,
    }

    gatherEvidenceMock.mockResolvedValueOnce([documentEvidence, noteEvidence])
    listStructuredDatasetsForDocumentMock.mockResolvedValue([])

    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse({ action: 'search', purpose: 'baseline evidence', query: 'discount return rate association' }))
      .mockResolvedValueOnce(
        jsonResponse({
          observations: [
            { statement: 'Orders with discounts above 10% show a higher observed return rate in Q3 2024.', evidenceIndexes: [1] },
            { statement: 'An internal audit found no single clear cause for the elevated rate.', evidenceIndexes: [2] },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'two independent sources gathered' }))
      .mockResolvedValueOnce(
        jsonResponse({
          synthesis: 'Discounted orders show an association with a higher return rate in this dataset; this does not establish that discounts caused the returns.',
          keyFindings: ['Discounted orders (>10%) show a higher observed return rate in Q3 2024.'],
          limitations: 'The association has not been isolated from other factors (region, product, season).',
          comparisons: [{ sourceNumbers: [1, 2], relationship: 'provides_additional_evidence', description: 'The ops review corroborates the pattern from the policy data without identifying a single cause.' }],
          gaps: [{ description: 'No variable isolating discount effect from region/product/season was investigated.', reason: 'missing_variable' }],
          followUpQuestions: [],
        }),
      )

    const { investigation } = await runResearchInvestigation({
      question: 'Investigate whether discounting appears related to returns.',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
    })

    expect(investigation.status).toBe('complete')
    expect(investigation.steps[0]!.evidence).toEqual([documentEvidence, noteEvidence])
    // Every observation traces back to a real, retrieved evidence item — never invented.
    for (const obs of investigation.steps[0]!.observations) {
      for (const evId of obs.evidenceIds) {
        expect(investigation.steps[0]!.evidence.some((e) => e.id === evId)).toBe(true)
      }
    }

    expect(investigation.comparisons).toHaveLength(1)
    expect(investigation.comparisons[0]!.sourceIds.sort()).toEqual(['doc-returns-policy', 'note-ops-review'].sort())
    expect(investigation.comparisons[0]!.relationship).toBe('provides_additional_evidence')

    expect(investigation.synthesis).toContain('does not establish that discounts caused')
    expect(investigation.gaps[0]!.reason).toBe('missing_variable')
  })

  it('a question with nothing findable in the library is declined honestly, never guessed at', async () => {
    streamChatCompletionMock.mockResolvedValueOnce(jsonResponse({ error: 'This library has no content about live competitor pricing.' }))

    const { investigation } = await runResearchInvestigation({
      question: 'What are our competitors charging today?',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
    })

    expect(investigation.status).toBe('declined')
    expect(investigation.steps).toHaveLength(0)
    expect(investigation.synthesis).toBeNull()
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })
})
