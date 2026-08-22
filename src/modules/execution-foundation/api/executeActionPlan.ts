import { executeCapability } from '@/modules/execution-foundation/api/executeCapability'
import { getExecutionRequest } from '@/modules/execution-foundation/api/executionQueries'
import { canStart } from '@/modules/execution-foundation/api/executionStateMachine'
import type { Action } from '@/modules/action-intelligence/action'
import type { ExecutionRequest } from '@/modules/execution-foundation/execution'

export type PlanExecutionStepOutcome = 'succeeded' | 'failed' | 'blocked'

export interface PlanExecutionStep {
  actionId: string
  executionRequestId: string
  outcome: PlanExecutionStepOutcome
  request: ExecutionRequest
  /** Real, honest reason — populated only for 'blocked' steps. */
  reason: string | null
}

/**
 * The whole-plan result — deliberately NOT a single pass/fail boolean.
 * I7.16 requires partial success/failure across a multi-action plan to
 * stay visible per-action, never collapsed into "the plan succeeded" or
 * "the plan failed."
 */
export interface PlanExecutionResult {
  steps: PlanExecutionStep[]
}

/**
 * Orders actions so every 'action'-kind dependency (Action.dependencies,
 * resolved against Action.id within the same ActionSet — see action.ts's
 * own doc comment) comes before its dependent. Defensive against a cycle
 * slipping past upstream validation (parsePlanningResponse.ts's own
 * 'circular_dependency' check) — a cycle still terminates and produces
 * *some* order rather than hanging; it is never this orchestrator's job
 * to re-diagnose a cycle upstream validation should already have caught.
 */
function topologicalOrder(actions: Action[]): Action[] {
  const byId = new Map(actions.map((a) => [a.id, a]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const order: Action[] = []

  function visit(action: Action): void {
    if (visited.has(action.id) || visiting.has(action.id)) return
    visiting.add(action.id)
    for (const dep of action.dependencies) {
      if (dep.kind === 'action' && dep.targetId) {
        const target = byId.get(dep.targetId)
        if (target) visit(target)
      }
    }
    visiting.delete(action.id)
    visited.add(action.id)
    order.push(action)
  }

  for (const action of actions) visit(action)
  return order
}

/**
 * Executes a multi-action plan's already-authorized execution requests in
 * dependency order (I7.17 — TASK DEPENDENCY -> ACTION DEPENDENCY, reusing
 * Action Intelligence's own dependency graph, never a duplicated one).
 * Every actual execution still goes through executeCapability.ts
 * unmodified — this only decides ORDER and whether to call it at all.
 *
 * When an action's own 'action'-kind dependency (that is itself part of
 * this same run) did not succeed, the action is marked 'blocked' and
 * executeCapability is never called for it — no execution_request status
 * is mutated, no attempt is recorded, because none was genuinely
 * attempted (I7.16's own "never report a whole-plan success" applies in
 * reverse here too: a blocked action must never be reported as if it had
 * been tried and failed).
 */
export async function executeActionPlan(params: {
  userId: string
  actions: Action[]
  /** One executionRequestId per action actually being run in this pass, keyed by Action.id. An action with no entry here is not part of this run and is skipped entirely. */
  executionRequestIdByActionId: Record<string, string>
}): Promise<PlanExecutionResult> {
  const { userId, actions, executionRequestIdByActionId } = params
  const order = topologicalOrder(actions)
  const outcomeByActionId = new Map<string, PlanExecutionStepOutcome>()
  const steps: PlanExecutionStep[] = []

  for (const action of order) {
    const executionRequestId = executionRequestIdByActionId[action.id]
    if (!executionRequestId) continue

    const blockingDependency = action.dependencies.find((dep) => {
      if (dep.kind !== 'action' || !dep.targetId) return false
      if (!executionRequestIdByActionId[dep.targetId]) return false
      return outcomeByActionId.get(dep.targetId) !== 'succeeded'
    })

    if (blockingDependency) {
      const request = await getExecutionRequest(executionRequestId)
      outcomeByActionId.set(action.id, 'blocked')
      steps.push({
        actionId: action.id,
        executionRequestId,
        outcome: 'blocked',
        request,
        reason: `Blocked by dependency "${blockingDependency.description}", which did not succeed in this run.`,
      })
      continue
    }

    const current = await getExecutionRequest(executionRequestId)
    if (!canStart(current.status)) {
      // Already terminal (a prior partial run already executed it) or never
      // authorized — report its real current status honestly rather than
      // re-attempting it or fabricating a fresh outcome.
      const outcome: PlanExecutionStepOutcome = current.status === 'succeeded' ? 'succeeded' : current.status === 'failed' ? 'failed' : 'blocked'
      outcomeByActionId.set(action.id, outcome)
      steps.push({
        actionId: action.id,
        executionRequestId,
        outcome,
        request: current,
        reason: outcome === 'blocked' ? `Execution request is "${current.status}" — it was never authorized to run in this pass.` : null,
      })
      continue
    }

    const request = await executeCapability({ executionRequestId, userId })
    const outcome: PlanExecutionStepOutcome = request.status === 'succeeded' ? 'succeeded' : 'failed'
    outcomeByActionId.set(action.id, outcome)
    steps.push({ actionId: action.id, executionRequestId, outcome, request, reason: null })
  }

  return { steps }
}
