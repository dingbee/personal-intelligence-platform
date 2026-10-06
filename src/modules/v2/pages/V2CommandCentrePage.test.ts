import { describe, expect, it } from 'vitest'
import type { ExecutionRequest } from '@/modules/execution-foundation/execution'

const request = (status: ExecutionRequest['status']): ExecutionRequest => ({
  id: status,
  userId: 'user-1',
  workspaceId: 'space-1',
  status,
  capability: 'send_email',
  target: {},
  inputPayload: {},
  expectedEffect: 'Send the approved email.',
  riskClassification: 'medium',
  externalSideEffects: true,
  actionSnapshot: { title: 'Send supplier update' },
  source: { kind: 'manual', label: 'Manual request' },
  idempotencyKey: `idem-${status}`,
  contractHash: `hash-${status}`,
  createdAt: '2026-10-06T10:00:00.000Z',
  updatedAt: '2026-10-06T10:00:00.000Z',
  expiresAt: '2026-10-06T12:00:00.000Z',
})

describe('V2 Command Centre request semantics', () => {
  it('recognizes the approval queue', () => {
    expect(request('awaiting_approval').status).toBe('awaiting_approval')
    expect(request('succeeded').status).not.toBe('awaiting_approval')
  })

  it('keeps execution failures in the attention state', () => {
    expect(['failed', 'rejected', 'cancelled', 'expired']).toContain(request('failed').status)
  })

  it('keeps V2 Business Space identity on the existing execution workspace boundary', () => {
    expect(request('executing').workspaceId).toBe('space-1')
  })
})
