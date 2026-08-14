import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/data-intelligence/module'

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

import { runDataIntelligenceQuery } from '@/modules/data-intelligence/api/runDataIntelligenceQuery'

const dataset = {
  id: 'dataset-1',
  documentId: 'document-1',
  userId: 'pro-user',
  workspaceId: 'workspace-1',
  sheetIndex: 0,
  sheetName: 'Sales',
  columns: [
    { name: 'Salesperson', columnIndex: 0, dataType: 'category' as const, meaning: 'category' as const, hasFormulas: false, distinctCount: 2, nonEmptyCount: 4 },
    { name: 'Total Price', columnIndex: 1, dataType: 'currency' as const, meaning: 'currency' as const, hasFormulas: false, distinctCount: 4, nonEmptyCount: 4 },
  ],
  rows: [
    ['Alice', 100],
    ['Alice', 50],
    ['Bob', 30],
    ['Bob', 10],
  ],
  rowCount: 4,
  columnCount: 2,
}

/**
 * Data Intelligence Foundation — exercises the REAL registered
 * 'data-intelligence-query' capability (module.ts imported for its side
 * effect) through the REAL runCapability entitlement gate, plus this
 * function's own explicit hasFeature check before the planning call —
 * mirroring generateWorkspaceBriefing.test.ts's exact convention.
 */
describe('runDataIntelligenceQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStructuredDatasetMock.mockResolvedValue(dataset)
    getChatProviderMock.mockReturnValue({ id: 'anthropic' })
    checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, limit: 1000 })
    consumeQuotaMock.mockResolvedValue(true)
  })

  it('denies a Free user before any AI call', async () => {
    hasFeatureMock.mockResolvedValue(false)

    await expect(
      runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'Who sold the most?', userId: 'free-user', workspaceId: 'workspace-1', chain: ['anthropic'] }),
    ).rejects.toThrow('requires an upgraded plan')

    expect(hasFeatureMock).toHaveBeenCalledWith('free-user', 'data_intelligence')
    expect(getStructuredDatasetMock).not.toHaveBeenCalled()
    expect(streamChatCompletionMock).not.toHaveBeenCalled()
  })

  it('rejects a dataset that does not belong to the caller (defense-in-depth on top of RLS)', async () => {
    hasFeatureMock.mockResolvedValue(true)
    getStructuredDatasetMock.mockResolvedValueOnce({ ...dataset, userId: 'someone-else' })

    await expect(
      runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'Who sold the most?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] }),
    ).rejects.toThrow('Dataset not found.')
  })

  it('plans, executes deterministically, and interprets the validated result for an entitled user', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock
      .mockResolvedValueOnce({ content: JSON.stringify({ dimensions: [{ column: 'Salesperson' }], measures: [{ as: 'total', aggregation: 'sum', column: 'Total Price' }] }), model: 'm' })
      .mockResolvedValueOnce({ content: 'Alice sold the most, totaling 150.', model: 'm' })

    const outcome = await runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'Who sold the most?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(outcome.status).toBe('answered')
    expect(outcome.answer).toBe('Alice sold the most, totaling 150.')
    expect(outcome.result?.status).toBe('ok')
    // Two AI calls: the planning call (streamChatCompletion directly) and the
    // interpretation call (runCapability, which itself calls
    // streamChatCompletion internally — the same mock, second invocation).
    // The planner never sees the computed answer — it only sees the schema.
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(2)
    const plannerCall = streamChatCompletionMock.mock.calls[0]![0] as { system: string }
    expect(plannerCall.system).not.toContain('Alice')
    const interpretationCall = streamChatCompletionMock.mock.calls[1]![0] as { system: string }
    expect(interpretationCall.system).toContain('Alice')
  })

  it('returns a declined outcome (no interpretation call) when the planner cannot build a plan', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock.mockResolvedValueOnce({ content: JSON.stringify({ error: 'This dataset has no column matching "profit margin".' }), model: 'm' })

    const outcome = await runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'What was our profit margin?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(outcome.status).toBe('declined')
    expect(outcome.reason).toContain('profit margin')
    expect(outcome.answer).toBeNull()
  })

  it('surfaces a validation error through interpretation rather than throwing', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock
      .mockResolvedValueOnce({ content: JSON.stringify({ measures: [{ as: 'x', aggregation: 'sum', column: 'Not A Real Column' }] }), model: 'm' })
      .mockResolvedValueOnce({ content: 'That column does not exist in this dataset.', model: 'm' })

    const outcome = await runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'Sum of a fake column?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(outcome.status).toBe('answered')
    expect(outcome.result?.status).toBe('error')
  })

  // Operation Budget Foundation
  describe('operation budget', () => {
    it('denies the query before any AI call when the monthly data_intelligence_operations quota is exhausted', async () => {
      hasFeatureMock.mockResolvedValue(true)
      checkQuotaMock.mockResolvedValueOnce({ allowed: false, reason: 'Monthly limit reached.' })

      await expect(
        runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'Who sold the most?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] }),
      ).rejects.toThrow('Monthly limit reached.')

      expect(streamChatCompletionMock).not.toHaveBeenCalled()
      expect(checkQuotaMock).toHaveBeenCalledWith('pro-user', 'data_intelligence_operations')
    })

    it('returns a budget_exhausted outcome, never a thrown error, when the operation budget runs out during planning', async () => {
      hasFeatureMock.mockResolvedValue(true)
      streamChatCompletionMock.mockRejectedValue(new Error('provider down'))
      // data_intelligence's hard ceiling is 6 calls; a 6-candidate chain that
      // fails on every candidate consumes the entire budget within the single
      // planning call.
      const sixProviderChain = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']

      const outcome = await runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'Who sold the most?', userId: 'pro-user', workspaceId: 'workspace-1', chain: sixProviderChain })

      expect(outcome.status).toBe('budget_exhausted')
      expect(outcome.answer).toBeNull()
      expect(outcome.result).toBeNull()
      expect(streamChatCompletionMock).toHaveBeenCalledTimes(6)
    })

    it('preserves the already-computed deterministic result when the budget runs out during interpretation, rather than discarding real work', async () => {
      hasFeatureMock.mockResolvedValue(true)
      // Plan succeeds on the first candidate (consumes 1 of the 6-call
      // budget); interpretation then fails on every one of the remaining 5
      // candidates, exhausting the budget exactly at the interpretation step.
      const fiveProviderChain = ['p1', 'p2', 'p3', 'p4', 'p5']
      streamChatCompletionMock
        .mockResolvedValueOnce({ content: JSON.stringify({ dimensions: [{ column: 'Salesperson' }], measures: [{ as: 'total', aggregation: 'sum', column: 'Total Price' }] }), model: 'm' })
        .mockRejectedValue(new Error('provider down'))

      const outcome = await runDataIntelligenceQuery({
        datasetId: 'dataset-1',
        question: 'Who sold the most?',
        userId: 'pro-user',
        workspaceId: 'workspace-1',
        chain: fiveProviderChain,
      })

      expect(outcome.status).toBe('budget_exhausted')
      // Plan succeeded (call 1) and executeAnalyticalPlan ran deterministically —
      // the real computed result must survive even though interpretation failed.
      expect(outcome.result?.status).toBe('ok')
      expect(outcome.answer).toBeNull()
      expect(streamChatCompletionMock).toHaveBeenCalledTimes(6)
    })

    it('threads operationId and operationType into every streamChatCompletion call so ai_requests stays groupable', async () => {
      hasFeatureMock.mockResolvedValue(true)
      streamChatCompletionMock
        .mockResolvedValueOnce({ content: JSON.stringify({ dimensions: [{ column: 'Salesperson' }], measures: [{ as: 'total', aggregation: 'sum', column: 'Total Price' }] }), model: 'm' })
        .mockResolvedValueOnce({ content: 'Alice sold the most.', model: 'm' })

      await runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'Who sold the most?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      const plannerCall = streamChatCompletionMock.mock.calls[0]![0] as { operationId?: string; operationType?: string }
      const interpretationCall = streamChatCompletionMock.mock.calls[1]![0] as { operationId?: string; operationType?: string }
      expect(plannerCall.operationType).toBe('data_intelligence')
      expect(typeof plannerCall.operationId).toBe('string')
      // Both AI calls in the same query belong to the SAME operation.
      expect(interpretationCall.operationId).toBe(plannerCall.operationId)
      expect(interpretationCall.operationType).toBe('data_intelligence')
    })

    it('marks the operation completed by consuming quota once per real attempt, never once per query regardless of call count', async () => {
      hasFeatureMock.mockResolvedValue(true)
      streamChatCompletionMock
        .mockResolvedValueOnce({ content: JSON.stringify({ dimensions: [{ column: 'Salesperson' }], measures: [{ as: 'total', aggregation: 'sum', column: 'Total Price' }] }), model: 'm' })
        .mockResolvedValueOnce({ content: 'Alice sold the most.', model: 'm' })

      await runDataIntelligenceQuery({ datasetId: 'dataset-1', question: 'Who sold the most?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

      // Two real AI calls (plan + interpretation) -> two consumeQuota calls.
      expect(consumeQuotaMock).toHaveBeenCalledTimes(2)
      expect(consumeQuotaMock).toHaveBeenCalledWith('pro-user', 'data_intelligence_operations')
    })
  })
})
