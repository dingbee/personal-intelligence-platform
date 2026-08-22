import { getWorkspaceObjective } from '@/modules/hub/api/objectives'
import { addActionAsWorkspaceObjective } from '@/modules/action-intelligence/api/addActionAsWorkspaceObjective'
import { linkActionToWorkspaceObjective } from '@/modules/action-intelligence/api/linkActionToWorkspaceObjective'
import { saveActionSetToNote } from '@/modules/action-intelligence/api/saveActionSetToNote'
import { isCapabilityAvailable } from '@/modules/execution-foundation/api/capabilityRegistry'
import { getExecutionRequest, listExecutionAttempts, listExecutionAuthorizations } from '@/modules/execution-foundation/api/executionQueries'
import { recordExecutionAttempt } from '@/modules/execution-foundation/api/recordExecutionAttempt'
import { decideRetry } from '@/modules/execution-foundation/api/retryPolicy'
import { startExecution } from '@/modules/execution-foundation/api/startExecution'
import { verifyOutcome } from '@/modules/execution-foundation/api/verifyOutcome'
import { recordExecutionIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordExecutionIntelligenceRecord'
import type { ExecutionOutcome, ExecutionRequest } from '@/modules/execution-foundation/execution'
import type { Action, ActionSet } from '@/modules/action-intelligence/action'

export class CapabilityUnavailableError extends Error {
  capability: string
  constructor(capability: string, reason?: string) {
    super(reason ?? `Capability "${capability}" is not available.`)
    this.name = 'CapabilityUnavailableError'
    this.capability = capability
  }
}

function wrapActionInThrowawaySet(action: Action, request: ExecutionRequest): ActionSet {
  return {
    id: `execution:${request.id}`,
    title: action.title,
    objective: null,
    status: 'complete',
    actions: [action],
    contextEvidence: [],
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId: request.workspaceId,
    createdAt: request.createdAt,
  }
}

/**
 * The Controlled Executor for the three SAFE INTERNAL capabilities
 * (sprint brief Phase 12) — each branch wraps an existing Action
 * Intelligence hook exactly as-is (saveActionSetToNote.ts,
 * addActionAsWorkspaceObjective.ts, linkActionToWorkspaceObjective.ts),
 * never a reimplementation. `wrapActionInThrowawaySet` mirrors
 * actionIntelligenceAdapter.ts's own precedent for reusing a batch
 * function on a single action.
 *
 * Every other capability id — including one a client could try to sneak
 * past buildExecutionContract.ts by editing a create_execution_request
 * call directly — falls through to the default case and returns a
 * 'capability_unavailable' failure. Nothing here ever reaches an email/
 * calendar/messaging/API/financial code path, because none exists.
 */
async function runSafeCapability(request: ExecutionRequest, userId: string): Promise<ExecutionOutcome> {
  const action = request.actionSnapshot as unknown as Action

  switch (request.capability) {
    case 'save_action_to_notes': {
      const note = await saveActionSetToNote({ actionSet: wrapActionInThrowawaySet(action, request), userId, workspaceId: request.workspaceId })
      return { outcome: 'succeeded', result: { noteId: note.id } }
    }
    case 'add_action_as_workspace_objective': {
      if (!request.workspaceId) return { outcome: 'failed', failureKind: 'validation', message: 'A workspace is required to add a workspace objective.' }
      const objective = await addActionAsWorkspaceObjective({ userId, workspaceId: request.workspaceId, action })
      return { outcome: 'succeeded', result: { objectiveId: objective.id } }
    }
    case 'link_action_to_workspace_objective': {
      const objectiveId = typeof request.target.objectiveId === 'string' ? request.target.objectiveId : null
      if (!objectiveId) return { outcome: 'failed', failureKind: 'validation', message: 'No target workspace objective was specified.' }
      const objective = await getWorkspaceObjective(objectiveId)
      const updated = await linkActionToWorkspaceObjective({ objective, action })
      return { outcome: 'succeeded', result: { objectiveId: updated.id } }
    }
    default:
      return { outcome: 'failed', failureKind: 'capability_unavailable', message: `Capability "${request.capability}" has no available executor.` }
  }
}

/**
 * approved -> executing -> (retry loop, bounded by retryPolicy.ts) ->
 * succeeded | failed. Refuses to even call start_execution() when the
 * capability is not currently available — the request stays 'approved'
 * rather than being falsely marked 'executing' for something that was
 * never going to run (sprint brief Phase 13's own CAPABILITY_UNAVAILABLE
 * requirement).
 */
/**
 * Intelligence Ledger — best-effort, never throws, never alters
 * executeCapability's own return value (see writeIntelligenceRecord.ts's
 * own doc comment). Called at both real exit points below (a genuine
 * success and a final, non-retryable failure) — unlike the other six
 * engines' single success-only hook, Execution Foundation already
 * records honest succeeded/failed status on the request itself, so
 * there is no risk of a failed execution being written as
 * status:'completed'.
 */
async function recordExecutionLedgerEvent(executionRequestId: string): Promise<void> {
  try {
    const [request, authorizations, attempts] = await Promise.all([
      getExecutionRequest(executionRequestId),
      listExecutionAuthorizations(executionRequestId),
      listExecutionAttempts(executionRequestId),
    ])
    await recordExecutionIntelligenceRecord({ request, authorizations, attempts })
  } catch (err) {
    console.error('[intelligence-ledger] failed to persist an execution intelligence record', err)
  }
}

export async function executeCapability(params: { executionRequestId: string; userId: string }): Promise<ExecutionRequest> {
  const { executionRequestId, userId } = params
  const initial = await getExecutionRequest(executionRequestId)

  if (!isCapabilityAvailable(initial.capability)) {
    throw new CapabilityUnavailableError(initial.capability)
  }

  const request = await startExecution(executionRequestId)

  let attemptNumber = 0
  for (;;) {
    attemptNumber += 1
    let outcome: ExecutionOutcome
    try {
      outcome = await runSafeCapability(request, userId)
    } catch (err) {
      outcome = { outcome: 'failed', failureKind: 'transient', message: err instanceof Error ? err.message : 'An unexpected error occurred.' }
    }

    if (outcome.outcome === 'succeeded') {
      // I7.12/I7.13 — a self-reported success is a claim, not proof. Re-read
      // the real target before recording the attempt as final, and fold the
      // OBSERVED outcome in alongside — never instead of — the self-reported
      // one, so a disagreement (verification: 'mismatch') stays visible
      // rather than silently overwriting the 'succeeded' execution result.
      const verification = await verifyOutcome(request, outcome.result)
      await recordExecutionAttempt({ executionRequestId, outcome: 'succeeded', result: { ...outcome.result, verification }, isFinal: true })
      await recordExecutionLedgerEvent(executionRequestId)
      return getExecutionRequest(executionRequestId)
    }

    const retry = decideRetry(outcome.failureKind, attemptNumber)
    await recordExecutionAttempt({ executionRequestId, outcome: 'failed', failureKind: outcome.failureKind, failureMessage: outcome.message, isFinal: retry.isFinal })
    if (!retry.shouldRetry) {
      await recordExecutionLedgerEvent(executionRequestId)
      return getExecutionRequest(executionRequestId)
    }
  }
}
