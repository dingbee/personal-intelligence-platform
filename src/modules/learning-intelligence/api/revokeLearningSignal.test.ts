import { describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { revokeLearningSignal } from '@/modules/learning-intelligence/api/revokeLearningSignal'

const row = {
  id: 'signal-1',
  user_id: 'user-1',
  workspace_id: null,
  record_type: 'execution',
  pattern_key: 'execution:capability:save_action_to_notes',
  direction: 'positive',
  statement: 'Pattern tends to match.',
  strength: 'weak',
  status: 'revoked',
  evidence_count: 1,
  contradicts_signal_id: null,
  revoked_reason: 'No longer accurate',
  revoked_at: '2026-01-02T00:00:00Z',
  first_evidence_at: '2026-01-01T00:00:00Z',
  last_evidence_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

describe('revokeLearningSignal', () => {
  it('calls revoke_learning_signal with the signal id and an explicit reason', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    await revokeLearningSignal('signal-1', 'No longer accurate')

    expect(rpcMock).toHaveBeenCalledWith('revoke_learning_signal', { p_signal_id: 'signal-1', p_reason: 'No longer accurate' })
  })

  it('passes a null reason when none is given', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    await revokeLearningSignal('signal-1')

    expect(rpcMock).toHaveBeenCalledWith('revoke_learning_signal', { p_signal_id: 'signal-1', p_reason: null })
  })

  it('maps the returned row to a revoked LearningSignal', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    const result = await revokeLearningSignal('signal-1', 'No longer accurate')

    expect(result.status).toBe('revoked')
    expect(result.revokedReason).toBe('No longer accurate')
  })

  it('throws on an RPC error (e.g. re-revoking an already-revoked signal)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('revoke_learning_signal: signal is already revoked') })

    await expect(revokeLearningSignal('signal-1')).rejects.toThrow('already revoked')
  })
})
