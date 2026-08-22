import { describe, expect, it } from 'vitest'
import { toLearningEvidenceLink, toLearningSignal, toOutcomeEvaluation } from '@/modules/learning-intelligence/api/mappers'

describe('toOutcomeEvaluation', () => {
  it('maps every DB row field to its camelCase domain equivalent', () => {
    const row = {
      id: 'evaluation-1',
      user_id: 'user-1',
      workspace_id: 'ws-1',
      record_id: 'record-1',
      source: 'user_feedback' as const,
      expected_outcome: 'A note is created',
      actual_outcome: 'This was not useful.',
      comparison_result: 'miss' as const,
      execution_succeeded: null,
      feedback_note: 'This was not useful.',
      pattern_key: 'execution:capability:save_action_to_notes',
      created_at: '2026-01-01T00:00:00Z',
    }

    expect(toOutcomeEvaluation(row)).toEqual({
      id: 'evaluation-1',
      userId: 'user-1',
      workspaceId: 'ws-1',
      recordId: 'record-1',
      source: 'user_feedback',
      expectedOutcome: 'A note is created',
      actualOutcome: 'This was not useful.',
      comparisonResult: 'miss',
      executionSucceeded: null,
      feedbackNote: 'This was not useful.',
      patternKey: 'execution:capability:save_action_to_notes',
      createdAt: '2026-01-01T00:00:00Z',
    })
  })
})

describe('toLearningSignal', () => {
  it('maps every DB row field to its camelCase domain equivalent', () => {
    const row = {
      id: 'signal-1',
      user_id: 'user-1',
      workspace_id: null,
      record_type: 'execution' as const,
      pattern_key: 'execution:capability:save_action_to_notes',
      direction: 'negative' as const,
      statement: 'Pattern tends to miss or contradict its expected outcome.',
      strength: 'moderate' as const,
      status: 'contested' as const,
      evidence_count: 3,
      contradicts_signal_id: 'signal-0',
      revoked_reason: null,
      revoked_at: null,
      first_evidence_at: '2026-01-01T00:00:00Z',
      last_evidence_at: '2026-01-03T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    }

    expect(toLearningSignal(row)).toEqual({
      id: 'signal-1',
      userId: 'user-1',
      workspaceId: null,
      recordType: 'execution',
      patternKey: 'execution:capability:save_action_to_notes',
      direction: 'negative',
      statement: 'Pattern tends to miss or contradict its expected outcome.',
      strength: 'moderate',
      status: 'contested',
      evidenceCount: 3,
      contradictsSignalId: 'signal-0',
      revokedReason: null,
      revokedAt: null,
      firstEvidenceAt: '2026-01-01T00:00:00Z',
      lastEvidenceAt: '2026-01-03T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-03T00:00:00Z',
    })
  })
})

describe('toLearningEvidenceLink', () => {
  it('maps every DB row field to its camelCase domain equivalent', () => {
    const row = { id: 'link-1', signal_id: 'signal-1', evaluation_id: 'evaluation-1', created_at: '2026-01-01T00:00:00Z' }
    expect(toLearningEvidenceLink(row)).toEqual({ id: 'link-1', signalId: 'signal-1', evaluationId: 'evaluation-1', createdAt: '2026-01-01T00:00:00Z' })
  })
})
