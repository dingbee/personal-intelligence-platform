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

import { runAnalysisInvestigation } from '@/modules/analysis-intelligence/api/runAnalysisInvestigation'

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
})
