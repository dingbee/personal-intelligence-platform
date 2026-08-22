import { describe, expect, it } from 'vitest'
import { isSignalStale } from '@/modules/learning-intelligence/api/signalStaleness'
import type { LearningSignal } from '@/modules/learning-intelligence/learning'

function mkSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    id: 'signal-1',
    userId: 'user-1',
    workspaceId: null,
    recordType: 'execution',
    patternKey: 'execution:capability:save_action_to_notes',
    direction: 'positive',
    statement: 'x',
    strength: 'moderate',
    status: 'active',
    evidenceCount: 2,
    contradictsSignalId: null,
    revokedReason: null,
    revokedAt: null,
    firstEvidenceAt: '2026-01-01T00:00:00Z',
    lastEvidenceAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('isSignalStale', () => {
  it('is not stale when recently corroborated', () => {
    const signal = mkSignal({ lastEvidenceAt: '2026-08-01T00:00:00Z' })
    expect(isSignalStale(signal, new Date('2026-08-22T00:00:00Z'))).toBe(false)
  })

  it('is stale after 90 days with no new evidence', () => {
    const signal = mkSignal({ lastEvidenceAt: '2026-01-01T00:00:00Z' })
    expect(isSignalStale(signal, new Date('2026-08-22T00:00:00Z'))).toBe(true)
  })

  it('a revoked signal is never described as stale — it already has an explicit, stronger status', () => {
    const signal = mkSignal({ status: 'revoked', lastEvidenceAt: '2020-01-01T00:00:00Z' })
    expect(isSignalStale(signal, new Date('2026-08-22T00:00:00Z'))).toBe(false)
  })
})
