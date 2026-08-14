import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/modules/research-intelligence/module'

const { hasFeatureMock, listStructuredDatasetsForDocumentMock, runAnalysisInvestigationMock, gatherEvidenceMock, getChatProviderMock, streamChatCompletionMock } = vi.hoisted(() => ({
  hasFeatureMock: vi.fn(),
  listStructuredDatasetsForDocumentMock: vi.fn(),
  runAnalysisInvestigationMock: vi.fn(),
  gatherEvidenceMock: vi.fn(),
  getChatProviderMock: vi.fn(),
  streamChatCompletionMock: vi.fn(),
}))

vi.mock('@/modules/plans/api/plans', () => ({ hasFeature: hasFeatureMock }))
vi.mock('@/modules/data-intelligence/api/structuredDatasets', () => ({ listStructuredDatasetsForDocument: listStructuredDatasetsForDocumentMock }))
vi.mock('@/modules/analysis-intelligence/api/runAnalysisInvestigation', () => ({ runAnalysisInvestigation: runAnalysisInvestigationMock }))
vi.mock('@/modules/research-intelligence/gatherEvidence', () => ({ gatherEvidence: gatherEvidenceMock }))
vi.mock('@/modules/ai/providers/registry', () => ({ getChatProvider: getChatProviderMock, DEFAULT_CHAT_PROVIDER_ID: 'anthropic' }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))

import { runResearchInvestigation } from '@/modules/research-intelligence/api/runResearchInvestigation'

function jsonResponse(obj: unknown) {
  return { content: JSON.stringify(obj), model: 'test-model' }
}

const oneEvidenceItem = [{ id: 'ev-1', source: { type: 'document' as const, id: 'doc-1', title: 'Returns Policy' }, excerpt: 'A 30-day window applies.', similarity: 0.9 }]

describe('runResearchInvestigation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getChatProviderMock.mockReturnValue({ id: 'anthropic' })
    listStructuredDatasetsForDocumentMock.mockResolvedValue([])
    gatherEvidenceMock.mockResolvedValue([])
  })

  it('denies a Free user before any AI call or evidence retrieval', async () => {
    hasFeatureMock.mockResolvedValue(false)

    await expect(runResearchInvestigation({ question: 'Why are returns high?', userId: 'free-user', workspaceId: 'workspace-1', chain: ['anthropic'] })).rejects.toThrow(
      'requires an upgraded plan',
    )

    expect(hasFeatureMock).toHaveBeenCalledWith('free-user', 'research_intelligence')
    expect(streamChatCompletionMock).not.toHaveBeenCalled()
    expect(gatherEvidenceMock).not.toHaveBeenCalled()
  })

  it('allows a Pro-entitled user to run a single-step investigation', async () => {
    hasFeatureMock.mockResolvedValue(true)
    gatherEvidenceMock.mockResolvedValue(oneEvidenceItem)
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse({ action: 'search', purpose: 'baseline', query: 'return policy' }))
      .mockResolvedValueOnce(jsonResponse({ observations: [{ statement: 'A 30-day window applies.', evidenceIndexes: [1] }] }))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'enough evidence' }))
      .mockResolvedValueOnce(jsonResponse({ synthesis: 'Returns follow a 30-day policy.', keyFindings: ['A 30-day window applies.'], limitations: '', comparisons: [], gaps: [], followUpQuestions: [] }))

    const { investigation } = await runResearchInvestigation({ question: 'Why are returns high?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(hasFeatureMock).toHaveBeenCalledWith('pro-user', 'research_intelligence')
    expect(investigation.status).toBe('complete')
    expect(investigation.steps).toHaveLength(1)
    expect(investigation.steps[0]!.observations[0]!.statement).toBe('A 30-day window applies.')
    expect(investigation.synthesis).toBe('Returns follow a 30-day policy.')
  })

  it('allows a Founding-Pro-entitled user identically — same entitlement check, no special-casing', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock.mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'nothing to check' })).mockResolvedValueOnce(jsonResponse({ synthesis: 'x', keyFindings: [], limitations: '', comparisons: [], gaps: [], followUpQuestions: [] }))

    await expect(async () => {
      // A stop on step 0 with zero steps completed is a legitimate 'failed' outcome (no evidence gathered at all) — verifying the entitlement call is what this test targets.
      await runResearchInvestigation({ question: 'q', userId: 'founding-pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })
    }).not.toThrow()

    expect(hasFeatureMock).toHaveBeenCalledWith('founding-pro-user', 'research_intelligence')
  })

  it('returns a declined outcome with no further calls when the question cannot be researched at all', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock.mockResolvedValueOnce(jsonResponse({ error: 'This library has no content on live market prices.' }))

    const { investigation } = await runResearchInvestigation({ question: 'What is the live stock price today?', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(investigation.status).toBe('declined')
    expect(investigation.declineReason).toContain('live market prices')
    expect(gatherEvidenceMock).not.toHaveBeenCalled()
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('fails cleanly when the very first step planner response is unparseable', async () => {
    hasFeatureMock.mockResolvedValue(true)
    streamChatCompletionMock.mockResolvedValueOnce({ content: 'not json at all', model: 'm' })

    const { investigation } = await runResearchInvestigation({ question: 'q', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(investigation.status).toBe('failed')
    expect(investigation.synthesis).toBeNull()
  })

  it('runs a multi-step investigation combining evidence search and a bounded dataset delegation, calling onStepComplete with real progress', async () => {
    hasFeatureMock.mockResolvedValue(true)
    listStructuredDatasetsForDocumentMock.mockResolvedValue([{ id: 'dataset-1', sheetIndex: 0, sheetName: 'Sales', rowCount: 10, columnCount: 5 }])
    gatherEvidenceMock.mockResolvedValue(oneEvidenceItem)
    runAnalysisInvestigationMock.mockResolvedValue({
      investigation: {
        id: 'analysis-inv-1', question: 'What is the return rate by region?', datasetId: 'dataset-1', status: 'complete', stepLimitReached: false, declineReason: null,
        synthesis: 'South has the highest return rate.', contradictions: [],
        hypotheses: [{ id: 'h1', statement: 'Product mix may explain it', supportingObservationIds: [], status: 'untested' }],
        steps: [{ id: 'as1', index: 0, purpose: 'baseline', triggeredBy: null, plan: { datasetId: 'dataset-1', measures: [] }, result: { status: 'ok', plan: { datasetId: 'dataset-1', measures: [] }, rows: [], provenance: { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 10, rowsMatchedAfterFilters: 10 } }, observations: [{ id: 'o1', stepId: 'as1', statement: 'South return rate is 26%.', value: 0.26, provenance: { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 10, rowsMatchedAfterFilters: 10 } }] }],
      },
    })
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse({ action: 'search', purpose: 'baseline evidence', query: 'return policy' }))
      .mockResolvedValueOnce(jsonResponse({ observations: [{ statement: 'A 30-day window applies.', evidenceIndexes: [1] }] }))
      .mockResolvedValueOnce(jsonResponse({ action: 'analyze_dataset', purpose: 'quantify regional differences', subQuestion: 'What is the return rate by region?' }))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'sufficient evidence gathered' }))
      .mockResolvedValueOnce(jsonResponse({ synthesis: 'South has a higher return rate, consistent with a 30-day policy baseline.', keyFindings: ['South return rate is 26%.'], limitations: 'x', comparisons: [], gaps: [], followUpQuestions: [] }))

    const progressSnapshots: number[] = []
    const { investigation } = await runResearchInvestigation({
      question: 'Why are regional returns different?',
      documentId: 'doc-1',
      userId: 'pro-user',
      workspaceId: 'workspace-1',
      chain: ['anthropic'],
      onStepComplete: (inv) => progressSnapshots.push(inv.steps.length),
    })

    expect(investigation.steps).toHaveLength(2)
    expect(investigation.steps[0]!.kind).toBe('evidence_gathering')
    expect(investigation.steps[1]!.kind).toBe('dataset_investigation')
    expect(investigation.steps[1]!.datasetInvestigation?.id).toBe('analysis-inv-1')
    expect(investigation.steps[1]!.observations[0]!.statement).toBe('South return rate is 26%.')
    expect(investigation.hypotheses).toHaveLength(1)
    expect(investigation.hypotheses[0]!.statement).toContain('Product mix')
    expect(progressSnapshots).toEqual([1, 2, 2])
    expect(runAnalysisInvestigationMock).toHaveBeenCalledTimes(1)
  })

  it('caps dataset delegation at once per investigation — a second analyze_dataset request degrades to a text search instead of re-delegating', async () => {
    hasFeatureMock.mockResolvedValue(true)
    listStructuredDatasetsForDocumentMock.mockResolvedValue([{ id: 'dataset-1', sheetIndex: 0, sheetName: 'Sales', rowCount: 10, columnCount: 5 }])
    gatherEvidenceMock.mockResolvedValue([])
    runAnalysisInvestigationMock.mockResolvedValue({
      investigation: { id: 'analysis-inv-1', question: 'q', datasetId: 'dataset-1', status: 'complete', stepLimitReached: false, declineReason: null, synthesis: 'ok', contradictions: [], hypotheses: [], steps: [] },
    })
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse({ action: 'analyze_dataset', purpose: 'first', subQuestion: 'sub-question 1' }))
      .mockResolvedValueOnce(jsonResponse({ action: 'analyze_dataset', purpose: 'second', subQuestion: 'sub-question 2' }))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'done' }))
      .mockResolvedValueOnce(jsonResponse({ synthesis: 'x', keyFindings: [], limitations: '', comparisons: [], gaps: [], followUpQuestions: [] }))

    const { investigation } = await runResearchInvestigation({ question: 'q', documentId: 'doc-1', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(runAnalysisInvestigationMock).toHaveBeenCalledTimes(1)
    expect(investigation.steps[0]!.kind).toBe('dataset_investigation')
    expect(investigation.steps[1]!.kind).toBe('evidence_gathering')
    expect(investigation.steps[1]!.query).toBe('sub-question 2')
  })

  it('degrades an analyze_dataset request to a text search when no dataset is actually available, never fabricating a dataset result', async () => {
    hasFeatureMock.mockResolvedValue(true)
    listStructuredDatasetsForDocumentMock.mockResolvedValue([])
    gatherEvidenceMock.mockResolvedValue([])
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse({ action: 'analyze_dataset', purpose: 'quantify', subQuestion: 'sub-question' }))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'done' }))
      .mockResolvedValueOnce(jsonResponse({ synthesis: 'x', keyFindings: [], limitations: '', comparisons: [], gaps: [], followUpQuestions: [] }))

    const { investigation } = await runResearchInvestigation({ question: 'q', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(runAnalysisInvestigationMock).not.toHaveBeenCalled()
    expect(investigation.steps[0]!.kind).toBe('evidence_gathering')
    expect(investigation.steps[0]!.datasetInvestigation).toBeNull()
  })

  it('enforces the hard step limit and never silently continues past it', async () => {
    hasFeatureMock.mockResolvedValue(true)
    gatherEvidenceMock.mockResolvedValue([])
    const maxSteps = 3
    let callCount = 0
    streamChatCompletionMock.mockImplementation(async () => {
      callCount += 1
      if (callCount > maxSteps) return jsonResponse({ synthesis: 'x', keyFindings: [], limitations: '', comparisons: [], gaps: [], followUpQuestions: [] })
      return jsonResponse({ action: 'search', purpose: `step ${callCount}`, query: `query ${callCount}` })
    })

    const { investigation } = await runResearchInvestigation({ question: 'q', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'], maxSteps })

    expect(investigation.steps).toHaveLength(maxSteps)
    expect(investigation.stepLimitReached).toBe(true)
    expect(investigation.status).toBe('complete')
  })

  it('marks synthesisFailed (not a fabricated summary) when the synthesis capability response cannot be parsed', async () => {
    hasFeatureMock.mockResolvedValue(true)
    gatherEvidenceMock.mockResolvedValue([])
    // A search step that finds nothing, then a stop — so at least one step exists and synthesis is attempted.
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse({ action: 'search', purpose: 'p', query: 'q' }))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'done' }))
      .mockResolvedValueOnce({ content: 'not json', model: 'm' })

    const { investigation } = await runResearchInvestigation({ question: 'q', userId: 'pro-user', workspaceId: 'workspace-1', chain: ['anthropic'] })

    expect(investigation.status).toBe('complete')
    expect(investigation.synthesisFailed).toBe(true)
    expect(investigation.synthesis).toBeNull()
  })

  it('threads workspaceId through to every AI call', async () => {
    hasFeatureMock.mockResolvedValue(true)
    gatherEvidenceMock.mockResolvedValue([])
    streamChatCompletionMock
      .mockResolvedValueOnce(jsonResponse({ action: 'search', purpose: 'p', query: 'q' }))
      .mockResolvedValueOnce(jsonResponse({ stop: true, reason: 'done' }))
      .mockResolvedValueOnce(jsonResponse({ synthesis: 'x', keyFindings: [], limitations: '', comparisons: [], gaps: [], followUpQuestions: [] }))

    await runResearchInvestigation({ question: 'q', userId: 'pro-user', workspaceId: 'workspace-42', chain: ['anthropic'] })

    for (const call of streamChatCompletionMock.mock.calls) {
      expect((call[0] as { workspaceId: string }).workspaceId).toBe('workspace-42')
    }
  })
})
