import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ARRIYIA — I7 real acceptance scenario: "Launch a controlled ARRIYIA
 * university pilot," the exact I6 plan already established as this
 * codebase's own real fixture (see planningIntelligence.acceptance.test.ts,
 * adaptPlanForActionContext.test.ts — not invented fresh here). Proves the
 * full chain end-to-end through the REAL modules:
 *
 *   PLAN -> ACTION -> EXECUTION REQUEST -> AUTHORIZATION -> EXECUTION
 *     -> RESULT -> VERIFICATION -> LEDGER
 *
 * Only the network boundary is faked — createExecutionRequest.ts,
 * authorizeExecution.ts, executeCapability.ts, executionQueries.ts,
 * verifyOutcome.ts, executeActionPlan.ts, buildExecutionContract.ts, and
 * adaptPlanForActionContext.ts all run unmodified, against a small
 * in-memory backend that mirrors the real SECURITY DEFINER RPCs' own
 * status-machine semantics (create -> awaiting_approval, authorize ->
 * approved/rejected, start -> executing (only from approved), record
 * attempt -> succeeded/failed). Those exact semantics are independently,
 * live-verified against production in
 * supabase/tests/execution_foundation_security_test.sql — this file is
 * the JS-integration counterpart, not a second authority on what the SQL
 * enforces.
 *
 * I7.28 Production-Safe Execution: step 4 below deliberately requests an
 * UNAVAILABLE external capability (send_email) to prove the system asks
 * for authorization honestly but never actually reaches an external
 * side effect — capability_unavailable, not a fabricated send. Step 5
 * executes only a real SAFE INTERNAL capability.
 */

const { getWorkspaceObjectiveMock, addActionAsWorkspaceObjectiveMock, saveActionSetToNoteMock, linkActionToWorkspaceObjectiveMock, getNoteMock, recordExecutionIntelligenceRecordMock } = vi.hoisted(() => ({
  getWorkspaceObjectiveMock: vi.fn(),
  addActionAsWorkspaceObjectiveMock: vi.fn(),
  saveActionSetToNoteMock: vi.fn(),
  linkActionToWorkspaceObjectiveMock: vi.fn(),
  getNoteMock: vi.fn(),
  recordExecutionIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/hub/api/objectives', () => ({ getWorkspaceObjective: getWorkspaceObjectiveMock }))
vi.mock('@/modules/action-intelligence/api/addActionAsWorkspaceObjective', () => ({ addActionAsWorkspaceObjective: addActionAsWorkspaceObjectiveMock }))
vi.mock('@/modules/action-intelligence/api/saveActionSetToNote', () => ({ saveActionSetToNote: saveActionSetToNoteMock }))
vi.mock('@/modules/action-intelligence/api/linkActionToWorkspaceObjective', () => ({ linkActionToWorkspaceObjective: linkActionToWorkspaceObjectiveMock }))
vi.mock('@/modules/notes/api/notes', () => ({ getNote: getNoteMock }))
vi.mock('@/modules/intelligence-ledger/api/recordExecutionIntelligenceRecord', () => ({ recordExecutionIntelligenceRecord: recordExecutionIntelligenceRecordMock }))

const CURRENT_USER = 'user-pilot-owner'

/** A minimal in-memory backend mirroring 0065/0085/0086's own RPC status-machine semantics — see this file's header doc comment. */
function makeFakeExecutionBackend() {
  const requests = new Map<string, Record<string, unknown>>()
  const attemptsByRequest = new Map<string, Record<string, unknown>[]>()
  let seq = 0
  const nowIso = () => new Date().toISOString()

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    switch (fn) {
      case 'create_execution_request': {
        for (const row of requests.values()) {
          if (row.user_id === CURRENT_USER && row.idempotency_key === args.p_idempotency_key) return { data: row, error: null }
        }
        const id = `req-${++seq}`
        const row = {
          id,
          user_id: CURRENT_USER,
          workspace_id: args.p_workspace_id ?? null,
          status: 'awaiting_approval',
          action_snapshot: args.p_action_snapshot,
          source: args.p_source,
          capability: args.p_capability,
          target: args.p_target,
          input_payload: args.p_input_payload,
          expected_effect: args.p_expected_effect,
          risk_classification: args.p_risk_classification,
          external_side_effects: args.p_external_side_effects,
          idempotency_key: args.p_idempotency_key,
          contract_hash: args.p_contract_hash,
          created_at: nowIso(),
          updated_at: nowIso(),
          expires_at: nowIso(),
        }
        requests.set(id, row)
        return { data: row, error: null }
      }
      case 'authorize_execution_request': {
        const row = requests.get(args.p_execution_request_id as string)
        if (!row) return { data: null, error: new Error('authorize_execution_request: not found') }
        if (!['proposed', 'awaiting_approval'].includes(row.status as string)) return { data: null, error: new Error('authorize_execution_request: invalid transition') }
        row.status = args.p_decision === 'approved' ? 'approved' : 'rejected'
        row.updated_at = nowIso()
        return {
          data: { id: `auth-${++seq}`, execution_request_id: row.id, approving_user_id: CURRENT_USER, decision: args.p_decision, capability: row.capability, target: row.target, scope: args.p_scope ?? {}, contract_hash_at_approval: row.contract_hash, expires_at: args.p_expires_at ?? null, created_at: nowIso() },
          error: null,
        }
      }
      case 'start_execution': {
        const row = requests.get(args.p_execution_request_id as string)
        if (!row) return { data: null, error: new Error('start_execution: not found') }
        if (row.status !== 'approved') return { data: null, error: new Error('start_execution: request is not approved') }
        row.status = 'executing'
        row.updated_at = nowIso()
        return { data: row, error: null }
      }
      case 'record_execution_attempt': {
        const row = requests.get(args.p_execution_request_id as string)
        if (!row) return { data: null, error: new Error('record_execution_attempt: not found') }
        const attempts = attemptsByRequest.get(row.id as string) ?? []
        const attempt = {
          id: `attempt-${++seq}`,
          execution_request_id: row.id,
          attempt_number: attempts.length + 1,
          started_at: nowIso(),
          completed_at: nowIso(),
          outcome: args.p_outcome,
          failure_kind: args.p_failure_kind ?? null,
          failure_message: args.p_failure_message ?? null,
          result: args.p_result ?? null,
        }
        attempts.push(attempt)
        attemptsByRequest.set(row.id as string, attempts)
        if (args.p_outcome === 'succeeded') row.status = 'succeeded'
        else if (args.p_is_final) row.status = 'failed'
        row.updated_at = nowIso()
        return { data: attempt, error: null }
      }
      default:
        throw new Error(`i7 acceptance fake backend: unmocked rpc "${fn}"`)
    }
  })

  function rowsFor(table: 'execution_requests' | 'execution_attempts'): Record<string, unknown>[] {
    if (table === 'execution_requests') return Array.from(requests.values())
    return Array.from(attemptsByRequest.values()).flat()
  }

  function makeQuery(rows: Record<string, unknown>[]): {
    eq: (col: string, val: unknown) => ReturnType<typeof makeQuery>
    order: () => ReturnType<typeof makeQuery>
    single: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }>
    then: (resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) => void
  } {
    return {
      eq(col: string, val: unknown) {
        return makeQuery(rows.filter((r) => r[col] === val))
      },
      order() {
        return makeQuery(rows)
      },
      single: async () => (rows.length === 1 ? { data: rows[0]!, error: null } : { data: null, error: new Error('not found') }),
      then(resolve) {
        resolve({ data: rows, error: null })
      },
    }
  }

  function from(table: 'execution_requests' | 'execution_attempts') {
    return { select: () => makeQuery(rowsFor(table)) }
  }

  return { rpc, from, requests }
}

const backend = makeFakeExecutionBackend()
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => backend.rpc(...(a as [string, Record<string, unknown>])), from: (t: 'execution_requests' | 'execution_attempts') => backend.from(t) } }))

import { adaptPlanForActionContext } from '@/modules/action-intelligence/api/adaptPlanForActionContext'
import { buildExecutionContract } from '@/modules/execution-foundation/api/buildExecutionContract'
import { createExecutionRequest } from '@/modules/execution-foundation/api/createExecutionRequest'
import { authorizeExecution } from '@/modules/execution-foundation/api/authorizeExecution'
import { executeCapability, CapabilityUnavailableError } from '@/modules/execution-foundation/api/executeCapability'
import { executeActionPlan } from '@/modules/execution-foundation/api/executeActionPlan'
import { getExecutionRequest } from '@/modules/execution-foundation/api/executionQueries'
import type { Action } from '@/modules/action-intelligence/action'
import type { Plan } from '@/modules/planning-intelligence/plan'

// The exact "ARRIYIA University Pilot Launch Plan" real fixture already
// established in planningIntelligence.acceptance.test.ts / adaptPlanForActionContext.test.ts.
const UNIVERSITY_PILOT_PLAN: Plan = {
  id: 'plan-university-pilot',
  title: 'ARRIYIA University Pilot Launch Plan',
  objective: 'Launch a pilot of ARRIYIA at a university before the start of next semester.',
  description: null,
  status: 'complete',
  currentState: null,
  desiredOutcome: null,
  gapAnalysis: null,
  assumptions: [],
  constraints: [{ id: 'con-1', constraint: 'No paid advertising budget for outreach', type: 'budget', severity: 'hard', origin: 'known' }],
  objectives: [],
  workstreams: [],
  milestones: [{ id: 'm-sponsor', title: 'Faculty sponsor secured', description: '', target: null, targetDate: '2027-01-15', sequence: 1, dependsOnMilestoneIds: [] }],
  tasks: [
    { id: 't-identify', title: 'Identify candidate faculty sponsors', description: '', milestoneId: 'm-sponsor', workstreamId: null, sequence: 1, dependsOnTaskIds: [], status: 'not_started', priority: 'high', estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
    { id: 't-pitch', title: 'Pitch a faculty sponsor', description: '', milestoneId: 'm-sponsor', workstreamId: null, sequence: 2, dependsOnTaskIds: ['t-identify'], status: 'not_started', priority: 'high', estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
  ],
  risks: [],
  decisions: [],
  outputs: [],
  successCriteria: [],
  resources: [],
  deadline: '2027-03-15',
  criticalPath: [],
  contextEvidence: [],
  workspaceId: 'ws-pilot',
  createdAt: '2026-01-01T00:00:00Z',
  validationIssues: [],
  revisionOf: null,
  revisionReason: null,
  budgetExhausted: false,
  generationFailed: false,
  declineReason: null,
}

function mkAction(overrides: Partial<Action> & { id: string; title: string }): Action {
  const planContext = adaptPlanForActionContext(UNIVERSITY_PILOT_PLAN)
  return {
    description: '',
    type: 'action',
    status: 'proposed',
    priority: 'high',
    sequence: 1,
    readiness: { state: 'ready', blockers: [], missingInformation: [] },
    dependencies: [],
    actor: { type: 'user', label: 'pilot owner' },
    source: { kind: 'plan', label: planContext.planTitle, planId: planContext.planId, decisionId: null },
    expectedOutput: { outcome: '', completionCriteria: null },
    dueHint: null,
    evidenceIds: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  backend.requests.clear()
  recordExecutionIntelligenceRecordMock.mockResolvedValue(undefined)
})

describe('I7 real acceptance scenario — ARRIYIA university pilot', () => {
  it('PLAN -> ACTION -> AUTHORIZATION -> EXECUTION -> RESULT -> VERIFICATION -> LEDGER, end to end through the real modules', async () => {
    // -- PLAN -> ACTION: two real actions derived from the real plan's own tasks, carrying real provenance.
    const actionCreateRecords = mkAction({ id: 'action-1', title: 'Create the faculty sponsor tracking objective' })
    const actionCommunication = mkAction({ id: 'action-2', title: 'Draft the outreach email for candidate sponsors' })
    expect(actionCreateRecords.source.planId).toBe('plan-university-pilot')
    expect(actionCommunication.source.planId).toBe('plan-university-pilot')

    // -- Step 1: internal project/task record -> add_action_as_workspace_objective.
    const contract1 = buildExecutionContract({ action: actionCreateRecords, capability: 'add_action_as_workspace_objective' })
    const req1 = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: contract1.contract, source: contract1.source, actionSnapshot: contract1.actionSnapshot })
    expect(req1.status).toBe('awaiting_approval')

    // -- Step 3: internal communication artifact -> save_action_to_notes.
    const contract2 = buildExecutionContract({ action: actionCommunication, capability: 'save_action_to_notes' })
    const req2 = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: contract2.contract, source: contract2.source, actionSnapshot: contract2.actionSnapshot })

    // -- Step 4: requesting a controlled EXTERNAL action — I7.28 production
    // safety: this capability is registered but deliberately unavailable.
    // Authorization can still be requested and granted honestly (the request
    // itself is harmless), but execution must refuse to reach anything
    // external.
    const req3 = await createExecutionRequest({
      workspaceId: 'ws-pilot',
      contract: { capability: 'send_email', target: {}, inputPayload: { actionId: 'action-3' }, expectedEffect: 'Sends an email to the faculty sponsor.', riskClassification: 'high', externalSideEffects: true },
      source: { kind: 'action', actionId: 'action-3', actionSource: { kind: 'plan', label: UNIVERSITY_PILOT_PLAN.title, planId: UNIVERSITY_PILOT_PLAN.id, decisionId: null } },
      actionSnapshot: null,
    })
    expect(req3.status).toBe('awaiting_approval')

    // -- AUTHORIZATION: approve 1 and 2 (safe internal), approve 3 (external) too — approval alone must never execute anything.
    await authorizeExecution({ executionRequestId: req1.id, decision: 'approved' })
    await authorizeExecution({ executionRequestId: req2.id, decision: 'approved' })
    await authorizeExecution({ executionRequestId: req3.id, decision: 'approved' })

    // -- EXECUTION (step 5, real safe capability): step 1's request executes for real.
    addActionAsWorkspaceObjectiveMock.mockResolvedValue({ id: 'obj-pilot-1' })
    getWorkspaceObjectiveMock.mockResolvedValue({ id: 'obj-pilot-1', content: 'Create the faculty sponsor tracking objective' })
    const executed1 = await executeCapability({ executionRequestId: req1.id, userId: CURRENT_USER })

    // -- RESULT: authoritative, not inferred.
    expect(executed1.status).toBe('succeeded')

    // -- VERIFICATION (step 6): the attempt's own result carries a genuine, independently re-read verification, not a copy of the claim.
    expect(backend.requests.get(req1.id)?.status).toBe('succeeded')
    expect(addActionAsWorkspaceObjectiveMock).toHaveBeenCalledTimes(1) // the real capability call that actually creates the objective
    expect(getWorkspaceObjectiveMock).toHaveBeenCalledWith('obj-pilot-1') // verifyOutcome's own independent re-read — a SEPARATE call, not a copy of the capability's own claim
    expect(getWorkspaceObjectiveMock).toHaveBeenCalledTimes(1)

    saveActionSetToNoteMock.mockResolvedValue({ id: 'note-pilot-1' })
    getNoteMock.mockResolvedValue({ id: 'note-pilot-1' })
    const executed2 = await executeCapability({ executionRequestId: req2.id, userId: CURRENT_USER })
    expect(executed2.status).toBe('succeeded')
    expect(getNoteMock).toHaveBeenCalledWith('note-pilot-1')

    // -- I7.28: the "controlled external action" NEVER actually executes — capability_unavailable, no external side effect, ever.
    const saveCallsBeforeExternalAttempt = saveActionSetToNoteMock.mock.calls.length
    const addObjectiveCallsBeforeExternalAttempt = addActionAsWorkspaceObjectiveMock.mock.calls.length
    await expect(executeCapability({ executionRequestId: req3.id, userId: CURRENT_USER })).rejects.toThrow(CapabilityUnavailableError)
    const req3Final = await getExecutionRequest(req3.id)
    expect(req3Final.status).toBe('approved') // never advanced to executing/succeeded — nothing was attempted
    // No adapter of any kind was reached — not even the wrong one.
    expect(saveActionSetToNoteMock.mock.calls.length).toBe(saveCallsBeforeExternalAttempt)
    expect(addActionAsWorkspaceObjectiveMock.mock.calls.length).toBe(addObjectiveCallsBeforeExternalAttempt)

    // -- LEDGER: the best-effort intelligence-ledger hook fired for both real, completed executions — never for the refused external one.
    expect(recordExecutionIntelligenceRecordMock).toHaveBeenCalledTimes(2)
  })

  it('dependency-aware partial execution over the SAME real plan-derived actions (I7.16/I7.17, Section 8)', async () => {
    const actionA = mkAction({ id: 'A', title: 'Identify candidate faculty sponsors' })
    const actionB = mkAction({ id: 'B', title: 'Pitch a faculty sponsor', dependencies: [{ id: 'dep-1', kind: 'action', targetId: 'A', description: 'Identify candidate faculty sponsors' }] })
    const actionC = mkAction({ id: 'C', title: 'Recruit the beta cohort', dependencies: [{ id: 'dep-2', kind: 'action', targetId: 'B', description: 'Pitch a faculty sponsor' }] })

    const cA = buildExecutionContract({ action: actionA, capability: 'save_action_to_notes' })
    const cB = buildExecutionContract({ action: actionB, capability: 'save_action_to_notes' })
    const cC = buildExecutionContract({ action: actionC, capability: 'save_action_to_notes' })
    const reqA = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: cA.contract, source: cA.source, actionSnapshot: cA.actionSnapshot })
    const reqB = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: cB.contract, source: cB.source, actionSnapshot: cB.actionSnapshot })
    const reqC = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: cC.contract, source: cC.source, actionSnapshot: cC.actionSnapshot })
    await authorizeExecution({ executionRequestId: reqA.id, decision: 'approved' })
    await authorizeExecution({ executionRequestId: reqB.id, decision: 'approved' })
    await authorizeExecution({ executionRequestId: reqC.id, decision: 'approved' })

    saveActionSetToNoteMock.mockResolvedValueOnce({ id: 'note-A' }).mockRejectedValue(new Error('B genuinely fails'))
    getNoteMock.mockResolvedValue({ id: 'note-A' })

    const result = await executeActionPlan({
      userId: CURRENT_USER,
      actions: [actionA, actionB, actionC],
      executionRequestIdByActionId: { A: reqA.id, B: reqB.id, C: reqC.id },
    })

    const byId = Object.fromEntries(result.steps.map((s) => [s.actionId, s]))
    expect(byId.A!.outcome).toBe('succeeded')
    expect(byId.B!.outcome).toBe('failed')
    expect(byId.C!.outcome).toBe('blocked')
  })

  it('Section 7: rejected approval leaves NO side effect; approved -> executed -> verified', async () => {
    const action = mkAction({ id: 'action-reject', title: 'Send weekly check-in reminder' })
    const contract = buildExecutionContract({ action, capability: 'save_action_to_notes' })
    const req = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: contract.contract, source: contract.source, actionSnapshot: contract.actionSnapshot })

    await authorizeExecution({ executionRequestId: req.id, decision: 'rejected' })
    const afterRejection = await getExecutionRequest(req.id)
    expect(afterRejection.status).toBe('rejected')
    expect(saveActionSetToNoteMock).not.toHaveBeenCalled()

    // A second, independent action: approved -> executed -> verified.
    const action2 = mkAction({ id: 'action-approve', title: 'Compile the retention report' })
    const contract2 = buildExecutionContract({ action: action2, capability: 'save_action_to_notes' })
    const req2 = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: contract2.contract, source: contract2.source, actionSnapshot: contract2.actionSnapshot })
    await authorizeExecution({ executionRequestId: req2.id, decision: 'approved' })
    saveActionSetToNoteMock.mockResolvedValue({ id: 'note-report' })
    getNoteMock.mockResolvedValue({ id: 'note-report' })
    const executed = await executeCapability({ executionRequestId: req2.id, userId: CURRENT_USER })
    expect(executed.status).toBe('succeeded')
    expect(getNoteMock).toHaveBeenCalledWith('note-report')
  })

  it('Section 5: the same contract requested twice (double-click / retry) produces exactly one execution request', async () => {
    const action = mkAction({ id: 'action-idem', title: 'Set up a feedback channel' })
    const contract = buildExecutionContract({ action, capability: 'save_action_to_notes' })

    const first = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: contract.contract, source: contract.source, actionSnapshot: contract.actionSnapshot })
    const second = await createExecutionRequest({ workspaceId: 'ws-pilot', contract: contract.contract, source: contract.source, actionSnapshot: contract.actionSnapshot })

    expect(second.id).toBe(first.id)
    expect(backend.requests.size).toBe(1)
  })
})
