import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getExecutionRequestMock, executeCapabilityMock } = vi.hoisted(() => ({
  getExecutionRequestMock: vi.fn(),
  executeCapabilityMock: vi.fn(),
}))

vi.mock('@/modules/execution-foundation/api/executionQueries', () => ({ getExecutionRequest: getExecutionRequestMock }))
vi.mock('@/modules/execution-foundation/api/executeCapability', () => ({ executeCapability: executeCapabilityMock }))

import { executeActionPlan } from '@/modules/execution-foundation/api/executeActionPlan'
import type { Action } from '@/modules/action-intelligence/action'
import type { ExecutionRequest } from '@/modules/execution-foundation/execution'

function mkAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'a',
    title: 'Action',
    description: '',
    type: 'action',
    status: 'proposed',
    priority: 'medium',
    sequence: 1,
    readiness: { state: 'ready', blockers: [], missingInformation: [] },
    dependencies: [],
    actor: { type: 'unassigned', label: null },
    source: { kind: 'user_instruction', label: 'x' },
    expectedOutput: { outcome: '', completionCriteria: null },
    dueHint: null,
    evidenceIds: [],
    ...overrides,
  }
}

function mkRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    id: 'req',
    userId: 'user-1',
    workspaceId: 'ws-1',
    status: 'approved',
    actionSnapshot: null,
    source: { kind: 'action', actionId: 'a', actionSource: { kind: 'user_instruction', label: 'x' } },
    capability: 'save_action_to_notes',
    target: {},
    inputPayload: {},
    expectedEffect: '',
    riskClassification: 'low',
    externalSideEffects: false,
    idempotencyKey: 'hash',
    contractHash: 'hash',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('executeActionPlan', () => {
  it('Section 8: A -> B -> C, A succeeds, B fails, C is blocked and never attempted', async () => {
    const actionA = mkAction({ id: 'A', title: 'Draft outreach' })
    const actionB = mkAction({ id: 'B', title: 'Send outreach', dependencies: [{ id: 'dep-1', kind: 'action', targetId: 'A', description: 'Draft outreach' }] })
    const actionC = mkAction({ id: 'C', title: 'Log the response', dependencies: [{ id: 'dep-2', kind: 'action', targetId: 'B', description: 'Send outreach' }] })

    getExecutionRequestMock.mockImplementation(async (id: string) => mkRequest({ id, status: 'approved' }))
    executeCapabilityMock.mockImplementation(async ({ executionRequestId }: { executionRequestId: string }) => {
      if (executionRequestId === 'req-A') return mkRequest({ id: 'req-A', status: 'succeeded' })
      if (executionRequestId === 'req-B') return mkRequest({ id: 'req-B', status: 'failed' })
      throw new Error(`unexpected execution of ${executionRequestId}`)
    })

    const result = await executeActionPlan({
      userId: 'user-1',
      actions: [actionA, actionB, actionC],
      executionRequestIdByActionId: { A: 'req-A', B: 'req-B', C: 'req-C' },
    })

    const byActionId = Object.fromEntries(result.steps.map((s) => [s.actionId, s]))
    expect(byActionId.A!.outcome).toBe('succeeded')
    expect(byActionId.B!.outcome).toBe('failed')
    expect(byActionId.C!.outcome).toBe('blocked')
    expect(byActionId.C!.reason).toContain('Send outreach')

    // C's own execution request must never have been passed to executeCapability —
    // it was never actually attempted, not attempted-and-failed.
    expect(executeCapabilityMock).not.toHaveBeenCalledWith(expect.objectContaining({ executionRequestId: 'req-C' }))
    expect(executeCapabilityMock).toHaveBeenCalledTimes(2)
  })

  it('independent actions with no shared dependency all execute', async () => {
    const actionA = mkAction({ id: 'A' })
    const actionB = mkAction({ id: 'B' })

    getExecutionRequestMock.mockImplementation(async (id: string) => mkRequest({ id, status: 'approved' }))
    executeCapabilityMock.mockImplementation(async ({ executionRequestId }: { executionRequestId: string }) => mkRequest({ id: executionRequestId, status: 'succeeded' }))

    const result = await executeActionPlan({ userId: 'user-1', actions: [actionA, actionB], executionRequestIdByActionId: { A: 'req-A', B: 'req-B' } })

    expect(result.steps.every((s) => s.outcome === 'succeeded')).toBe(true)
    expect(executeCapabilityMock).toHaveBeenCalledTimes(2)
  })

  it('a dependency on an action NOT included in this run never blocks — only in-run dependencies count', async () => {
    const actionB = mkAction({ id: 'B', dependencies: [{ id: 'dep-1', kind: 'action', targetId: 'A', description: 'Some other action not in this run' }] })

    getExecutionRequestMock.mockImplementation(async (id: string) => mkRequest({ id, status: 'approved' }))
    executeCapabilityMock.mockResolvedValue(mkRequest({ id: 'req-B', status: 'succeeded' }))

    const result = await executeActionPlan({ userId: 'user-1', actions: [actionB], executionRequestIdByActionId: { B: 'req-B' } })

    expect(result.steps[0]!.outcome).toBe('succeeded')
    expect(executeCapabilityMock).toHaveBeenCalledWith({ executionRequestId: 'req-B', userId: 'user-1' })
  })

  it('an already-succeeded execution request is reported honestly, never re-attempted', async () => {
    const actionA = mkAction({ id: 'A' })
    getExecutionRequestMock.mockResolvedValue(mkRequest({ id: 'req-A', status: 'succeeded' }))

    const result = await executeActionPlan({ userId: 'user-1', actions: [actionA], executionRequestIdByActionId: { A: 'req-A' } })

    expect(result.steps[0]!.outcome).toBe('succeeded')
    expect(executeCapabilityMock).not.toHaveBeenCalled()
  })

  it('an execution request that was never authorized (still awaiting_approval) is reported as blocked, not silently skipped', async () => {
    const actionA = mkAction({ id: 'A' })
    getExecutionRequestMock.mockResolvedValue(mkRequest({ id: 'req-A', status: 'awaiting_approval' }))

    const result = await executeActionPlan({ userId: 'user-1', actions: [actionA], executionRequestIdByActionId: { A: 'req-A' } })

    expect(result.steps[0]!.outcome).toBe('blocked')
    expect(result.steps[0]!.reason).toContain('never authorized')
    expect(executeCapabilityMock).not.toHaveBeenCalled()
  })

  it('an action with no execution request in this run is skipped entirely, contributing no step', async () => {
    const actionA = mkAction({ id: 'A' })
    const actionB = mkAction({ id: 'B' })
    getExecutionRequestMock.mockResolvedValue(mkRequest({ id: 'req-A', status: 'succeeded' }))
    executeCapabilityMock.mockResolvedValue(mkRequest({ id: 'req-A', status: 'succeeded' }))

    const result = await executeActionPlan({ userId: 'user-1', actions: [actionA, actionB], executionRequestIdByActionId: { A: 'req-A' } })

    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]!.actionId).toBe('A')
  })
})
