import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getIntelligenceRecordMock, getLearningSignalMock, listContradictingSignalsMock, listEvidenceForSignalMock, listOutcomeEvaluationsByIdsMock } = vi.hoisted(() => ({
  getIntelligenceRecordMock: vi.fn(),
  getLearningSignalMock: vi.fn(),
  listContradictingSignalsMock: vi.fn(),
  listEvidenceForSignalMock: vi.fn(),
  listOutcomeEvaluationsByIdsMock: vi.fn(),
}))

vi.mock('@/modules/intelligence-ledger/api/ledgerQueries', () => ({ getIntelligenceRecord: getIntelligenceRecordMock }))
vi.mock('@/modules/learning-intelligence/api/learningQueries', () => ({
  getLearningSignal: getLearningSignalMock,
  listContradictingSignals: listContradictingSignalsMock,
  listEvidenceForSignal: listEvidenceForSignalMock,
  listOutcomeEvaluationsByIds: listOutcomeEvaluationsByIdsMock,
}))

import { getLearningSignalProvenance } from '@/modules/learning-intelligence/api/getLearningSignalProvenance'

function mkSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'signal-1',
    userId: 'user-1',
    workspaceId: null,
    recordType: 'execution',
    patternKey: 'execution:capability:save_action_to_notes',
    direction: 'positive',
    statement: 'Pattern tends to match.',
    strength: 'moderate',
    status: 'active',
    evidenceCount: 2,
    contradictsSignalId: null,
    revokedReason: null,
    revokedAt: null,
    firstEvidenceAt: '2026-01-01T00:00:00Z',
    lastEvidenceAt: '2026-01-02T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

function mkEvaluation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evaluation-1',
    userId: 'user-1',
    workspaceId: null,
    recordId: 'record-1',
    source: 'system_observed',
    expectedOutcome: 'x',
    actualOutcome: 'y',
    comparisonResult: 'match',
    executionSucceeded: true,
    feedbackNote: null,
    patternKey: 'execution:capability:save_action_to_notes',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listContradictingSignalsMock.mockResolvedValue([])
})

describe('getLearningSignalProvenance', () => {
  it('walks signal -> evidence -> evaluations -> real underlying records, never fabricating a link', async () => {
    getLearningSignalMock.mockResolvedValueOnce(mkSignal())
    listEvidenceForSignalMock.mockResolvedValueOnce([
      { id: 'link-1', signalId: 'signal-1', evaluationId: 'evaluation-1', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'link-2', signalId: 'signal-1', evaluationId: 'evaluation-2', createdAt: '2026-01-02T00:00:00Z' },
    ])
    listOutcomeEvaluationsByIdsMock.mockResolvedValueOnce([
      mkEvaluation({ id: 'evaluation-1', recordId: 'record-1' }),
      mkEvaluation({ id: 'evaluation-2', recordId: 'record-1' }),
    ])
    getIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1', summary: 'Execution: save_action_to_notes (succeeded)' })

    const result = await getLearningSignalProvenance('signal-1')

    expect(result.signal.id).toBe('signal-1')
    expect(result.evidence).toHaveLength(2)
    expect(result.evidence[0]!.record?.id).toBe('record-1')
    expect(listOutcomeEvaluationsByIdsMock).toHaveBeenCalledWith(['evaluation-1', 'evaluation-2'])
    // Only ONE fetch for the record even though two evaluations point at it — never redundant.
    expect(getIntelligenceRecordMock).toHaveBeenCalledTimes(1)
  })

  it('resolves the contradicts and contradictedBy links when they exist', async () => {
    getLearningSignalMock.mockResolvedValueOnce(mkSignal({ contradictsSignalId: 'signal-0' })).mockResolvedValueOnce(mkSignal({ id: 'signal-0', direction: 'negative' }))
    listContradictingSignalsMock.mockResolvedValueOnce([mkSignal({ id: 'signal-2', contradictsSignalId: 'signal-1' })])
    listEvidenceForSignalMock.mockResolvedValueOnce([])
    listOutcomeEvaluationsByIdsMock.mockResolvedValueOnce([])

    const result = await getLearningSignalProvenance('signal-1')

    expect(result.contradicts?.id).toBe('signal-0')
    expect(result.contradictedBy).toHaveLength(1)
    expect(result.contradictedBy[0]!.id).toBe('signal-2')
  })

  it('returns null contradicts when the signal never contested anything', async () => {
    getLearningSignalMock.mockResolvedValueOnce(mkSignal({ contradictsSignalId: null }))
    listEvidenceForSignalMock.mockResolvedValueOnce([])
    listOutcomeEvaluationsByIdsMock.mockResolvedValueOnce([])

    const result = await getLearningSignalProvenance('signal-1')

    expect(result.contradicts).toBeNull()
    expect(getLearningSignalMock).toHaveBeenCalledTimes(1)
  })

  it('never crashes when an evidenced record was independently deleted — records the gap honestly as null, not a fabricated stand-in', async () => {
    getLearningSignalMock.mockResolvedValueOnce(mkSignal())
    listEvidenceForSignalMock.mockResolvedValueOnce([{ id: 'link-1', signalId: 'signal-1', evaluationId: 'evaluation-1', createdAt: '2026-01-01T00:00:00Z' }])
    listOutcomeEvaluationsByIdsMock.mockResolvedValueOnce([mkEvaluation({ id: 'evaluation-1', recordId: 'record-deleted' })])
    getIntelligenceRecordMock.mockRejectedValueOnce(new Error('not found'))

    const result = await getLearningSignalProvenance('signal-1')

    expect(result.evidence[0]!.record).toBeNull()
  })
})
