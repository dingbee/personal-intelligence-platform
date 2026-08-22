import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getNoteMock, getWorkspaceObjectiveMock } = vi.hoisted(() => ({
  getNoteMock: vi.fn(),
  getWorkspaceObjectiveMock: vi.fn(),
}))

vi.mock('@/modules/notes/api/notes', () => ({ getNote: getNoteMock }))
vi.mock('@/modules/hub/api/objectives', () => ({ getWorkspaceObjective: getWorkspaceObjectiveMock }))

import { verifyOutcome } from '@/modules/execution-foundation/api/verifyOutcome'
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
    status: 'executing',
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
})

describe('verifyOutcome', () => {
  describe('save_action_to_notes', () => {
    it('verified: re-reads the reported note and confirms it exists', async () => {
      getNoteMock.mockResolvedValue({ id: 'note-1' })
      const verification = await verifyOutcome(makeRequest(), { noteId: 'note-1' })
      expect(getNoteMock).toHaveBeenCalledWith('note-1')
      expect(verification.status).toBe('verified')
    })

    it('mismatch: the reported noteId does not exist on re-read', async () => {
      getNoteMock.mockRejectedValue({ code: 'PGRST116', message: 'no rows' })
      const verification = await verifyOutcome(makeRequest(), { noteId: 'note-missing' })
      expect(verification.status).toBe('mismatch')
      expect(verification.details).toContain('note-missing')
    })

    it('unverified: no noteId was reported at all', async () => {
      const verification = await verifyOutcome(makeRequest(), {})
      expect(getNoteMock).not.toHaveBeenCalled()
      expect(verification.status).toBe('unverified')
    })

    it('unverified: an unrelated read error never becomes verified or mismatch', async () => {
      getNoteMock.mockRejectedValue(new Error('network timeout'))
      const verification = await verifyOutcome(makeRequest(), { noteId: 'note-1' })
      expect(verification.status).toBe('unverified')
      expect(verification.details).toContain('network timeout')
    })
  })

  describe('add_action_as_workspace_objective', () => {
    it('verified: re-reads the reported objective and confirms it exists', async () => {
      getWorkspaceObjectiveMock.mockResolvedValue({ id: 'obj-1', content: 'x' })
      const verification = await verifyOutcome(makeRequest({ capability: 'add_action_as_workspace_objective' }), { objectiveId: 'obj-1' })
      expect(verification.status).toBe('verified')
    })

    it('mismatch: the reported objectiveId does not exist on re-read', async () => {
      getWorkspaceObjectiveMock.mockRejectedValue({ code: 'PGRST116', message: 'no rows' })
      const verification = await verifyOutcome(makeRequest({ capability: 'add_action_as_workspace_objective' }), { objectiveId: 'obj-missing' })
      expect(verification.status).toBe('mismatch')
    })
  })

  describe('link_action_to_workspace_objective', () => {
    it('verified: the re-read objective content contains the expected reference to the action', async () => {
      getWorkspaceObjectiveMock.mockResolvedValue({ id: 'obj-1', content: 'Existing objective\n\nRelated action: Send the follow-up' })
      const verification = await verifyOutcome(makeRequest({ capability: 'link_action_to_workspace_objective', target: { objectiveId: 'obj-1' } }), { objectiveId: 'obj-1' })
      expect(verification.status).toBe('verified')
    })

    it('mismatch: the re-read objective content does NOT contain the expected reference (deliberate disagreement)', async () => {
      getWorkspaceObjectiveMock.mockResolvedValue({ id: 'obj-1', content: 'Existing objective, never actually updated' })
      const verification = await verifyOutcome(makeRequest({ capability: 'link_action_to_workspace_objective', target: { objectiveId: 'obj-1' } }), { objectiveId: 'obj-1' })
      expect(verification.status).toBe('mismatch')
      expect(verification.details).toContain('Send the follow-up')
    })
  })

  it('unverified: capability has no verification strategy', async () => {
    const verification = await verifyOutcome(makeRequest({ capability: 'send_email' }), { anything: true })
    expect(verification.status).toBe('unverified')
  })

  it('every verification carries a checkedAt timestamp', async () => {
    const verification = await verifyOutcome(makeRequest({ capability: 'send_email' }), {})
    expect(typeof verification.checkedAt).toBe('string')
    expect(new Date(verification.checkedAt).toString()).not.toBe('Invalid Date')
  })
})
