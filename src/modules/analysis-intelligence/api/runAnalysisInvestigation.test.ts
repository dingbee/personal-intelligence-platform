import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/analysis-intelligence/module'

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
// Operation Budget Foundation — beginIntelligenceOperation/runOperationAiCall
// talk to quotaService, which talks to Supabase directly; mock it the same
// way AIService.test.ts does so this suite doesn't hit the real project.
const { checkQuotaMock, consumeQuotaMock } = vi.hoisted(() => ({
  checkQuotaMock: vi.fn(),
  consumeQuotaMock: vi.fn(),
}))
vi.mock('@/shared/lib/quotaService', () => ({
  quotaService: { checkQuota: checkQuotaMock, consumeQuota: consumeQuotaMock },
}))

import { runAnalysisInvestigation } from '@/modules/analysis-intelligence/api/runAnalysisInvestigation'
import { beginIntelligenceOperation } from '@/shared/lib/intelligenceOperations'

const dataset = {
  id: 'dataset-1',
  documentId: 'document-1',
  userId: 'pro-user',
  workspaceId: 'workspace-1',
  sheetIndex: 0,
  sheetName: 'Sales',
  columns: [
    { name: 'Region', columnIndex: 0, dataType: 'category' as const, meaning: 'category' as const, hasFormulas: false, distinctCount: 2, nonEmptyCount: 6 },
    { name: 'Product', columnIndex: 1, dataType: 'category' as const, meaning: 'category' as const, hasFormulas: false, distinctCount: 2, nonEmptyCount: 6 },
    { name: 'Returned', columnIndex: 2, dataType: 'category' as const, meaning: 'category' as const, hasFormulas: false, distinctCount: 2, nonEmptyCount: 6 },
  ],
  rows: [
    ['South', 'Widget', true],
    ['South', 'Widget', true],
    ['South', 'Gadget', false],
    ['North', 'Widget', false],
    ['North', 'Gadget', false],
    ['North', 'Gadget', true],
  ],
  rowCount: 6,
  columnCount: 3,
}

const returnRateByRegionPlan = {
  purpose: 'baseline: return rate by region',
  hypothesis: null,
  plan: {
    dimensions: [{ column: 'Region' }],
    measures: [{ as: 'returnRate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count', filters: [{ column: 'Returned', op: 'eq', value: true }] }, denominator: { aggregation: 'count' } } }],
  },
}

const returnRateByProductPlan = {
  purpose: 'follow-up: return rate by product',
  hypothesis: 'Product mix may explain the difference',
  plan: {
    dimensions: [{ column: 'Product' }],
    measures: [{ as: 'returnRate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count', filters: [{ column: 'Returned', op: 'eq', value: true }] }, denominator: { aggregation: 'count' } } }],
  },
}

function jsonResponse(obj: unknown) {
  return { content: JSON.stringify(obj), model: 'test-model' }
}

describe('runAnalysisInvestigation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getStructuredDatasetMock.mockResolvedValue(dataset)
    getChatProviderMock.mockReturnValue({ id: 'anthropic' })
    checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, limit: 1000 })
    consumeQuotaMock.mockResolvedValue(true)
  })

  it('denies a Free user before any AI call', async () => {
    hasFeatureMock.mockResolvedValue(false)

    await expect(
      runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'free-user', workspaceId: 'workspace-1', chain: ['anthropic'] }),
    ).rejects.toThrow('requires an upgraded plan')

    expect(hasFeatureMock).toHaveBeenCalledWith('free-user', 'analysis_intelligence')
    expect(getStructuredDatasetMock).not.toHaveBeenCalled()
    expect(streamChatCompletionMock).not.toHaveBeenCalled()
  })

  it('allows a Pro-entitled user to run an investigation', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'Clear pattern established.' }))
    streamChatCompletionMock.mockResolvedValueOnce({ content: 'South has a higher observed return rate.', model: 'm' }) // synthesis (runCapability -> streamChatCompletion)

    const { investigation } = await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(hasFeatureMock).toHaveBeenCalledWith('pro-user', 'analysis_intelligence')
    expect(investigation.status).toBe('complete')
    expect(investigation.steps).toHaveLength(1)
  })

  it('allows a Founding-Pro-entitled user identically — same entitlement check, no special-casing', async () => {
    hasFeatureMock.mockResolvedValue(true)
    getStructuredDatasetMock.mockResolvedValueOnce({ ...dataset, userId: 'founding-pro-user' })
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'done' }))
      .mockResolvedValueOnce({ content: 'Findings.', model: 'm' })

    const { investigation } = await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'founding-pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(hasFeatureMock).toHaveBeenCalledWith('founding-pro-user', 'analysis_intelligence')
    expect(investigation.status).toBe('complete')
  })

  it('rejects a dataset that does not belong to the caller (defense-in-depth on top of RLS)', async () => {
    hasFeatureMock.mockResolvedValue(true)
    getStructuredDatasetMock.mockResolvedValueOnce({ ...dataset, userId: 'someone-else' })

    await expect(
      runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] }),
    ).rejects.toThrow('Dataset not found.')
  })

  it('runs a multi-step investigation, threading prior observations into the next step\'s prompt, and calls onStepComplete with real progress', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan))
      .mockResolvedValueOnce(jsonResponse(returnRateByProductPlan))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'Sufficient evidence gathered.' }))
      .mockResolvedValueOnce({ content: 'South has a higher return rate, driven in part by Widget.', model: 'm' })

    const progressSnapshots: number[] = []
    const { investigation } = await runAnalysisInvestigation({
      datasetId: 'dataset-1',
      question: 'Why is South high?',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
      onStepComplete: (inv) => progressSnapshots.push(inv.steps.length),
    })

    expect(investigation.steps).toHaveLength(2)
    expect(investigation.steps[1]!.triggeredBy).toBe(investigation.steps[0]!.id)
    expect(investigation.hypotheses).toHaveLength(1)
    expect(investigation.hypotheses[0]!.statement).toContain('Product mix')
    expect(investigation.synthesis).toContain('South has a higher return rate')
    // The second step's prompt must have seen the first step's observations.
    const secondStepCall = streamChatCompletionMock.mock.calls[1]![0] as { system: string }
    expect(secondStepCall.system).toContain('South')
    // Called after step 1, after step 2, and once more when synthesis completes (still 2 steps, now with `synthesis` populated).
    expect(progressSnapshots).toEqual([1, 2, 2])
  })

  it('enforces the hard step limit and never silently continues past it', async () => {
    hasFeatureMock.mockResolvedValue(true)
    // The planner never chooses to stop — every call proposes another plan.
    streamChatCompletionMock.mockImplementation(async () => jsonResponse(returnRateByRegionPlan))
    // Synthesis call is the (maxSteps+1)th streamChatCompletion invocation via runCapability.
    const maxSteps = 3
    let callCount = 0
    streamChatCompletionMock.mockImplementation(async () => {
      callCount += 1
      if (callCount > maxSteps) return { content: 'Investigation depth was limited.', model: 'm' }
      return jsonResponse(returnRateByRegionPlan)
    })

    const { investigation } = await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'], maxSteps })

    expect(investigation.steps).toHaveLength(maxSteps)
    expect(investigation.stepLimitReached).toBe(true)
    expect(investigation.status).toBe('complete')
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(maxSteps + 1)
  })

  it('returns a declined outcome with no synthesis call when the question cannot be investigated at all', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock.mockResolvedValueOnce(jsonResponse({ error: 'No column relates to customer sentiment.' }))

    const { investigation } = await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'What is customer sentiment?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(investigation.status).toBe('declined')
    expect(investigation.declineReason).toContain('sentiment')
    expect(investigation.synthesis).toBeNull()
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('fails cleanly with no synthesis call when the very first step planner response is unparseable', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock.mockResolvedValueOnce({ content: 'not json at all', model: 'm' })

    const { investigation } = await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(investigation.status).toBe('failed')
    expect(investigation.synthesis).toBeNull()
  })

  it('stops after a failed analytical step (invalid column) and still synthesizes the evidence gathered so far, never fabricating a result', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan))
      .mockResolvedValueOnce(jsonResponse({ purpose: 'follow-up', hypothesis: null, plan: { dimensions: [{ column: 'Not A Real Column' }], measures: [{ as: 'n', aggregation: 'count' }] } }))
      .mockResolvedValueOnce({ content: 'One finding established; a follow-up step failed.', model: 'm' })

    const { investigation } = await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(investigation.steps).toHaveLength(2)
    expect(investigation.steps[1]!.result.status).toBe('error')
    expect(investigation.steps[1]!.observations).toEqual([])
    expect(investigation.status).toBe('complete')
    expect(investigation.synthesis).toContain('failed')
  })

  it('threads workspaceId through to every AI call', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock.mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan)).mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'done' })).mockResolvedValueOnce({ content: 'ok', model: 'm' })

    await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-42', chain: ['anthropic'] })

    for (const call of streamChatCompletionMock.mock.calls) {
      expect((call[0] as { workspaceId: string }).workspaceId).toBe('workspace-42')
    }
  })

  // Operation Budget Foundation
  describe('operation budget', () => {
    it('denies the investigation before any AI call when the monthly analysis_intelligence_operations quota is exhausted', async () => {
      hasFeatureMock.mockResolvedValue(true)
      checkQuotaMock.mockResolvedValueOnce({ allowed: false, reason: 'Monthly limit reached.' })

      await expect(
        runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] }),
      ).rejects.toThrow('Monthly limit reached.')

      expect(streamChatCompletionMock).not.toHaveBeenCalled()
      expect(checkQuotaMock).toHaveBeenCalledWith('pro-user', 'analysis_intelligence_operations')
    })

    it('marks the investigation budgetExhausted (never fabricating synthesis) when the budget runs out before the first step completes', async () => {
      hasFeatureMock.mockResolvedValue(true)
      streamChatCompletionMock.mockRejectedValue(new Error('provider down'))
      // analysis_intelligence's hard ceiling is 18 — an 18-candidate chain
      // that fails on every candidate exhausts the whole budget on step 0.
      const chain = Array.from({ length: 18 }, (_, i) => `p${i}`)

      const { investigation } = await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-1', chain })

      expect(investigation.status).toBe('failed')
      expect(investigation.synthesis).toBeNull()
      expect(streamChatCompletionMock).toHaveBeenCalledTimes(18)
    })

    it('preserves real steps already gathered and skips synthesis when the budget runs out mid-investigation', async () => {
      hasFeatureMock.mockResolvedValue(true)
      // analysis_intelligence's hard ceiling is 18. Step 0 succeeds on the
      // first candidate (consumes 1 of the 18-call budget). Every call
      // after that fails, so the step-planner call for step 1, retrying all
      // 17 remaining candidates, exhausts the budget exactly at call 18 —
      // synthesis is never attempted.
      streamChatCompletionMock.mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan)).mockRejectedValue(new Error('provider down'))
      const seventeenProviderChain = Array.from({ length: 17 }, (_, i) => `p${i}`)

      const { investigation } = await runAnalysisInvestigation({
        datasetId: 'dataset-1',
        question: 'Why is South high?',
        userId: 'pro-user',
        workspaceId: 'workspace-1',
        chain: seventeenProviderChain,
        maxSteps: 5,
      })

      expect(investigation.status).toBe('complete')
      expect(investigation.budgetExhausted).toBe(true)
      expect(investigation.synthesis).toBeNull()
      // The one real step already gathered is preserved, not discarded.
      expect(investigation.steps).toHaveLength(1)
      expect(investigation.stepLimitReached).toBe(false)
      expect(streamChatCompletionMock).toHaveBeenCalledTimes(18)
    })

    it('threads operationId and operationType into every AI call', async () => {
      hasFeatureMock.mockResolvedValue(true)
      streamChatCompletionMock
        .mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan))
        .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'done' }))
        .mockResolvedValueOnce({ content: 'Findings.', model: 'm' })

      await runAnalysisInvestigation({ datasetId: 'dataset-1', question: 'Why is South high?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      const operationIds = streamChatCompletionMock.mock.calls.map((call) => (call[0] as { operationId?: string }).operationId)
      const operationTypes = streamChatCompletionMock.mock.calls.map((call) => (call[0] as { operationType?: string }).operationType)
      expect(operationTypes.every((t) => t === 'analysis_intelligence')).toBe(true)
      // All three AI calls (2 steps + synthesis) share the SAME operation.
      expect(new Set(operationIds).size).toBe(1)
    })

    it('reuses a supplied parentOperation instead of opening a new one — delegated AI calls consume the CALLER\'s budget, never a second independent operation', async () => {
      hasFeatureMock.mockResolvedValue(true)
      streamChatCompletionMock
        .mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan))
        .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'done' }))
        .mockResolvedValueOnce({ content: 'Findings.', model: 'm' })

      const parentOperation = await beginIntelligenceOperation({ operationType: 'research_intelligence', userId: 'pro-user', workspaceId: 'workspace-1' })
      checkQuotaMock.mockClear() // beginIntelligenceOperation above already called checkQuota once — isolate what happens next.

      const { investigation } = await runAnalysisInvestigation({
        datasetId: 'dataset-1',
        question: 'Why is South high?',
        userId: 'pro-user',
        workspaceId: 'workspace-1',
        chain: ['anthropic'],
        parentOperation,
      })

      // No second beginIntelligenceOperation call happened — checkQuota was
      // never called again for a fresh operation.
      expect(checkQuotaMock).not.toHaveBeenCalled()
      // All 3 AI calls this delegated investigation made consumed the
      // PARENT's budget and quota key (research_intelligence_operations),
      // not a new analysis_intelligence_operations one.
      expect(parentOperation.callsConsumed).toBe(3)
      expect(consumeQuotaMock).toHaveBeenCalledTimes(3)
      for (const call of consumeQuotaMock.mock.calls) {
        expect(call[1]).toBe('research_intelligence_operations')
      }
      expect(investigation.status).toBe('complete')
      // A delegated investigation never marks the shared parent operation
      // 'completed' itself — only the top-level caller that owns it does.
      expect(parentOperation.status).not.toBe('completed')
    })

    it('a delegated investigation still honestly reports budgetExhausted when the shared parent operation runs out mid-delegation', async () => {
      hasFeatureMock.mockResolvedValue(true)
      streamChatCompletionMock.mockResolvedValueOnce(jsonResponse(returnRateByRegionPlan)).mockRejectedValue(new Error('provider down'))

      const parentOperation = await beginIntelligenceOperation({ operationType: 'research_intelligence', userId: 'pro-user', workspaceId: 'workspace-1', requestedBudget: 2 })

      const { investigation } = await runAnalysisInvestigation({
        datasetId: 'dataset-1',
        question: 'Why is South high?',
        userId: 'pro-user',
        workspaceId: 'workspace-1',
        chain: ['p1', 'p2'],
        parentOperation,
      })

      expect(investigation.budgetExhausted).toBe(true)
      expect(investigation.synthesis).toBeNull()
      expect(parentOperation.callsConsumed).toBe(2)
    })
  })
})
