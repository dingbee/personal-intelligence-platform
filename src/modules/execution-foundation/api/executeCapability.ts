import { getWorkspaceObjective } from '@/modules/hub/api/objectives'
import { addActionAsWorkspaceObjective } from '@/modules/action-intelligence/api/addActionAsWorkspaceObjective'
import { linkActionToWorkspaceObjective } from '@/modules/action-intelligence/api/linkActionToWorkspaceObjective'
import { saveActionSetToNote } from '@/modules/action-intelligence/api/saveActionSetToNote'
import { isCapabilityAvailable } from '@/modules/execution-foundation/api/capabilityRegistry'
import { getExecutionRequest } from '@/modules/execution-foundation/api/executionQueries'
import { recordExecutionAttempt } from '@/modules/execution-foundation/api/recordExecutionAttempt'
import { decideRetry } from '@/modules/execution-foundation/api/retryPolicy'
import { startExecution } from '@/modules/execution-foundation/api/startExecution'
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
      await recordExecutionAttempt({ executionRequestId, outcome: 'succeeded', result: outcome.result, isFinal: true })
      return getExecutionRequest(executionRequestId)
    }

    const retry = decideRetry(outcome.failureKind, attemptNumber)
    await recordExecutionAttempt({ executionRequestId, outcome: 'failed', failureKind: outcome.failureKind, failureMessage: outcome.message, isFinal: retry.isFinal })
    if (!retry.shouldRetry) return getExecutionRequest(executionRequestId)
  }
}
