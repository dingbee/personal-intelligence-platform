import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getWorkspaceObjectiveMock,
  addActionAsWorkspaceObjectiveMock,
  linkActionToWorkspaceObjectiveMock,
  saveActionSetToNoteMock,
  isCapabilityAvailableMock,
  getExecutionRequestMock,
  listExecutionAuthorizationsMock,
  listExecutionAttemptsMock,
  recordExecutionAttemptMock,
  startExecutionMock,
  recordExecutionIntelligenceRecordMock,
} = vi.hoisted(() => ({
  getWorkspaceObjectiveMock: vi.fn(),
  addActionAsWorkspaceObjectiveMock: vi.fn(),
  linkActionToWorkspaceObjectiveMock: vi.fn(),
  saveActionSetToNoteMock: vi.fn(),
  isCapabilityAvailableMock: vi.fn(),
  getExecutionRequestMock: vi.fn(),
  listExecutionAuthorizationsMock: vi.fn(),
  listExecutionAttemptsMock: vi.fn(),
  recordExecutionAttemptMock: vi.fn(),
  startExecutionMock: vi.fn(),
  recordExecutionIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/hub/api/objectives', () => ({ getWorkspaceObjective: getWorkspaceObjectiveMock }))
vi.mock('@/modules/action-intelligence/api/addActionAsWorkspaceObjective', () => ({ addActionAsWorkspaceObjective: addActionAsWorkspaceObjectiveMock }))
vi.mock('@/modules/action-intelligence/api/linkActionToWorkspaceObjective', () => ({ linkActionToWorkspaceObjective: linkActionToWorkspaceObjectiveMock }))
vi.mock('@/modules/action-intelligence/api/saveActionSetToNote', () => ({ saveActionSetToNote: saveActionSetToNoteMock }))
vi.mock('@/modules/execution-foundation/api/capabilityRegistry', () => ({ isCapabilityAvailable: isCapabilityAvailableMock }))
vi.mock('@/modules/execution-foundation/api/executionQueries', () => ({
  getExecutionRequest: getExecutionRequestMock,
  listExecutionAuthorizations: listExecutionAuthorizationsMock,
  listExecutionAttempts: listExecutionAttemptsMock,
}))
vi.mock('@/modules/execution-foundation/api/recordExecutionAttempt', () => ({ recordExecutionAttempt: recordExecutionAttemptMock }))
vi.mock('@/modules/execution-foundation/api/startExecution', () => ({ startExecution: startExecutionMock }))
vi.mock('@/modules/intelligence-ledger/api/recordExecutionIntelligenceRecord', () => ({ recordExecutionIntelligenceRecord: recordExecutionIntelligenceRecordMock }))

import { CapabilityUnavailableError, executeCapability } from '@/modules/execution-foundation/api/executeCapability'
import type { Action } from '@/modules/action-intelligence/action'
import type { ExecutionRequest } from '@/modules/execution-foundation/execution'

const action: Action = {
  id: 'action-1',
  title: 'Send the follow-up',
  description: 'Follow up with the vendor.',
  type: 'action',
  status: 'proposed',
  priority: 'medium',
  sequence: 1,
  readiness: { state: 'ready', blockers: [], missingInformation: [] },
  dependencies: [],
  actor: { type: 'unassigned', label: null },
  source: { kind: 'user_instruction', label: 'User instruction' },
  expectedOutput: { outcome: 'Vendor is notified.', completionCriteria: null },
  dueHint: null,
  evidenceIds: [],
}

function makeRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    id: 'req-1',
    userId: 'user-1',
    workspaceId: 'ws-1',
    status: 'approved',
    actionSnapshot: action as unknown as Record<string, unknown>,
    source: { kind: 'action', actionId: 'action-1', actionSource: { kind: 'user_instruction', label: 'User instruction' } },
    capability: 'save_action_to_notes',
    target: {},
    inputPayload: { actionId: 'action-1' },
    expectedEffect: 'Saves the action to a note.',
    riskClassification: 'low',
    externalSideEffects: false,
    idempotencyKey: 'hash-1',
    contractHash: 'hash-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  isCapabilityAvailableMock.mockReturnValue(true)
  recordExecutionAttemptMock.mockResolvedValue({})
  listExecutionAuthorizationsMock.mockResolvedValue([])
  listExecutionAttemptsMock.mockResolvedValue([])
  recordExecutionIntelligenceRecordMock.mockResolvedValue(undefined)
})

describe('executeCapability', () => {
  it('refuses to call startExecution when the capability is unavailable, leaving the request approved', async () => {
    isCapabilityAvailableMock.mockReturnValue(false)
    getExecutionRequestMock.mockResolvedValue(makeRequest({ capability: 'send_email' }))

    await expect(executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })).rejects.toThrow(CapabilityUnavailableError)

    expect(startExecutionMock).not.toHaveBeenCalled()
    expect(recordExecutionAttemptMock).not.toHaveBeenCalled()
    expect(recordExecutionIntelligenceRecordMock).not.toHaveBeenCalled()
  })

  it('save_action_to_notes: wraps the action in a throwaway ActionSet and reuses saveActionSetToNote unmodified', async () => {
    const request = makeRequest()
    getExecutionRequestMock.mockResolvedValueOnce(request).mockResolvedValue({ ...request, status: 'succeeded' })
    startExecutionMock.mockResolvedValue({ ...request, status: 'executing' })
    saveActionSetToNoteMock.mockResolvedValue({ id: 'note-1' })

    const result = await executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })

    expect(saveActionSetToNoteMock).toHaveBeenCalledTimes(1)
    const call = saveActionSetToNoteMock.mock.calls[0]![0]
    expect(call.actionSet.actions).toEqual([action])
    expect(call.userId).toBe('user-1')
    expect(recordExecutionAttemptMock).toHaveBeenCalledWith({ executionRequestId: 'req-1', outcome: 'succeeded', result: { noteId: 'note-1' }, isFinal: true })
    expect(result.status).toBe('succeeded')
    expect(recordExecutionIntelligenceRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ status: 'succeeded' }) }),
    )
  })

  it('add_action_as_workspace_objective: fails validation (not capability_unavailable) when workspaceId is missing', async () => {
    const request = makeRequest({ capability: 'add_action_as_workspace_objective', workspaceId: null })
    getExecutionRequestMock.mockResolvedValueOnce(request).mockResolvedValue({ ...request, status: 'failed' })
    startExecutionMock.mockResolvedValue({ ...request, status: 'executing' })

    await executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })

    expect(addActionAsWorkspaceObjectiveMock).not.toHaveBeenCalled()
    expect(recordExecutionAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failed', failureKind: 'validation', isFinal: true }),
    )
    // A failed execution must never be persisted to the Ledger as
    // status:'completed' — recordExecutionLedgerEvent reads the
    // just-fetched (honestly 'failed') request, never assumes success.
    expect(recordExecutionIntelligenceRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ status: 'failed' }) }),
    )
  })

  it('link_action_to_workspace_objective: fails validation when no target objectiveId is present', async () => {
    const request = makeRequest({ capability: 'link_action_to_workspace_objective', target: {} })
    getExecutionRequestMock.mockResolvedValueOnce(request).mockResolvedValue({ ...request, status: 'failed' })
    startExecutionMock.mockResolvedValue({ ...request, status: 'executing' })

    await executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })

    expect(getWorkspaceObjectiveMock).not.toHaveBeenCalled()
    expect(linkActionToWorkspaceObjectiveMock).not.toHaveBeenCalled()
    expect(recordExecutionAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ failureKind: 'validation', isFinal: true }))
  })

  it('link_action_to_workspace_objective: resolves the objective and links on success', async () => {
    const request = makeRequest({ capability: 'link_action_to_workspace_objective', target: { objectiveId: 'obj-1' } })
    getExecutionRequestMock.mockResolvedValueOnce(request).mockResolvedValue({ ...request, status: 'succeeded' })
    startExecutionMock.mockResolvedValue({ ...request, status: 'executing' })
    const objective = { id: 'obj-1', content: 'Existing objective' }
    getWorkspaceObjectiveMock.mockResolvedValue(objective)
    linkActionToWorkspaceObjectiveMock.mockResolvedValue({ id: 'obj-1' })

    await executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })

    expect(getWorkspaceObjectiveMock).toHaveBeenCalledWith('obj-1')
    expect(linkActionToWorkspaceObjectiveMock).toHaveBeenCalledWith({ objective, action })
    expect(recordExecutionAttemptMock).toHaveBeenCalledWith({ executionRequestId: 'req-1', outcome: 'succeeded', result: { objectiveId: 'obj-1' }, isFinal: true })
  })

  it('an unknown/unregistered capability id fails as capability_unavailable, never reaching a mutation path', async () => {
    isCapabilityAvailableMock.mockReturnValue(true)
    const request = makeRequest({ capability: 'send_calendar_invite' })
    getExecutionRequestMock.mockResolvedValueOnce(request).mockResolvedValue({ ...request, status: 'failed' })
    startExecutionMock.mockResolvedValue({ ...request, status: 'executing' })

    await executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })

    expect(saveActionSetToNoteMock).not.toHaveBeenCalled()
    expect(addActionAsWorkspaceObjectiveMock).not.toHaveBeenCalled()
    expect(linkActionToWorkspaceObjectiveMock).not.toHaveBeenCalled()
    expect(recordExecutionAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ failureKind: 'capability_unavailable', isFinal: true }))
  })

  it('retries a transient failure and eventually succeeds within the retry bound', async () => {
    const request = makeRequest()
    getExecutionRequestMock.mockResolvedValueOnce(request).mockResolvedValue({ ...request, status: 'succeeded' })
    startExecutionMock.mockResolvedValue({ ...request, status: 'executing' })
    saveActionSetToNoteMock.mockRejectedValueOnce(new Error('network blip')).mockResolvedValueOnce({ id: 'note-1' })

    const result = await executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })

    expect(saveActionSetToNoteMock).toHaveBeenCalledTimes(2)
    expect(recordExecutionAttemptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ outcome: 'failed', failureKind: 'transient', isFinal: false }))
    expect(recordExecutionAttemptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ outcome: 'succeeded', isFinal: true }))
    expect(result.status).toBe('succeeded')
  })

  it('stops retrying once MAX_EXECUTION_ATTEMPTS is reached and records a final failure', async () => {
    const request = makeRequest()
    getExecutionRequestMock.mockResolvedValueOnce(request).mockResolvedValue({ ...request, status: 'failed' })
    startExecutionMock.mockResolvedValue({ ...request, status: 'executing' })
    saveActionSetToNoteMock.mockRejectedValue(new Error('still failing'))

    await executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })

    expect(saveActionSetToNoteMock).toHaveBeenCalledTimes(3)
    expect(recordExecutionAttemptMock).toHaveBeenCalledTimes(3)
    expect(recordExecutionAttemptMock).toHaveBeenNthCalledWith(3, expect.objectContaining({ outcome: 'failed', isFinal: true }))
  })

  it('a permanent failure is never retried, regardless of attempt number', async () => {
    const request = makeRequest({ capability: 'add_action_as_workspace_objective', workspaceId: null })
    getExecutionRequestMock.mockResolvedValueOnce(request).mockResolvedValue({ ...request, status: 'failed' })
    startExecutionMock.mockResolvedValue({ ...request, status: 'executing' })

    await executeCapability({ executionRequestId: 'req-1', userId: 'user-1' })

    expect(recordExecutionAttemptMock).toHaveBeenCalledTimes(1)
    expect(recordExecutionAttemptMock).toHaveBeenCalledWith(expect.objectContaining({ failureKind: 'validation', isFinal: true }))
  })
})
