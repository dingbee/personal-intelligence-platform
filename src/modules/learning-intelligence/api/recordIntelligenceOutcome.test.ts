import { describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { deriveDecisionPatternKey, deriveExecutionPatternKey, derivePlanningPatternKey, recordIntelligenceOutcome } from '@/modules/learning-intelligence/api/recordIntelligenceOutcome'

const row = {
  id: 'evaluation-1',
  user_id: 'user-1',
  workspace_id: 'ws-1',
  record_id: 'record-1',
  source: 'system_observed',
  expected_outcome: 'A note is created',
  actual_outcome: 'Note confirmed to exist.',
  comparison_result: 'match',
  execution_succeeded: true,
  feedback_note: null,
  pattern_key: 'execution:capability:save_action_to_notes',
  created_at: '2026-01-01T00:00:00Z',
}

describe('recordIntelligenceOutcome', () => {
  it('calls record_intelligence_outcome with the exact RPC param names, mapping camelCase to snake_case', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    await recordIntelligenceOutcome({
      recordId: 'record-1',
      source: 'system_observed',
      expectedOutcome: 'A note is created',
      actualOutcome: 'Note confirmed to exist.',
      comparisonResult: 'match',
      patternKey: 'execution:capability:save_action_to_notes',
      executionSucceeded: true,
    })

    expect(rpcMock).toHaveBeenCalledWith('record_intelligence_outcome', {
      p_record_id: 'record-1',
      p_source: 'system_observed',
      p_expected_outcome: 'A note is created',
      p_actual_outcome: 'Note confirmed to exist.',
      p_comparison_result: 'match',
      p_pattern_key: 'execution:capability:save_action_to_notes',
      p_execution_succeeded: true,
      p_feedback_note: null,
    })
  })

  it('maps the returned row to a domain OutcomeEvaluation', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    const result = await recordIntelligenceOutcome({
      recordId: 'record-1',
      source: 'system_observed',
      expectedOutcome: 'A note is created',
      actualOutcome: 'Note confirmed to exist.',
      comparisonResult: 'match',
      patternKey: 'execution:capability:save_action_to_notes',
    })

    expect(result).toEqual({
      id: 'evaluation-1',
      userId: 'user-1',
      workspaceId: 'ws-1',
      recordId: 'record-1',
      source: 'system_observed',
      expectedOutcome: 'A note is created',
      actualOutcome: 'Note confirmed to exist.',
      comparisonResult: 'match',
      executionSucceeded: true,
      feedbackNote: null,
      patternKey: 'execution:capability:save_action_to_notes',
      createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('throws on an RPC error (e.g. entitlement denial) rather than swallowing it', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('record_intelligence_outcome: learning intelligence requires an upgraded plan') })

    await expect(
      recordIntelligenceOutcome({ recordId: 'record-1', source: 'system_observed', expectedOutcome: 'x', actualOutcome: 'y', comparisonResult: 'match', patternKey: 'test:pattern' }),
    ).rejects.toThrow('upgraded plan')
  })
})

describe('pattern-key derivation — deterministic, never free text', () => {
  it('deriveExecutionPatternKey uses the real capability id', () => {
    expect(deriveExecutionPatternKey('save_action_to_notes')).toBe('execution:capability:save_action_to_notes')
  })

  it('deriveDecisionPatternKey uses the real decision confidence value', () => {
    expect(deriveDecisionPatternKey('high')).toBe('decision:confidence:high')
    expect(deriveDecisionPatternKey('low')).toBe('decision:confidence:low')
  })

  it('derivePlanningPatternKey uses one of the fixed, real variance categories', () => {
    expect(derivePlanningPatternKey('timeline_variance')).toBe('planning:timeline_variance')
    expect(derivePlanningPatternKey('resource_variance')).toBe('planning:resource_variance')
  })
})
