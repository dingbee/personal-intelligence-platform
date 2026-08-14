import type { Action, ActionValidationIssue } from '@/modules/action-intelligence/action'

const ACTOR_REQUIRED_TYPES = new Set(['action', 'task', 'follow_up'])

/**
 * Deterministic structural validation for a fully-assembled action set —
 * mirrors validatePlan.ts/validateDecision.ts's own "never silently
 * repair" discipline, and is deliberately the LAST validator to run
 * (after computeActionReadiness.ts has already attached each action's
 * `readiness`) so it can catch a genuine self-consistency problem
 * (`contradictory_readiness`) as an independent defense-in-depth check,
 * the same role Decision's own `contradictory_recommendation` plays.
 *
 * `dependencyIssues` (from analyzeActionDependencies.ts — dangling
 * references, circular dependencies) is merged in rather than
 * recomputed, so there is exactly one source of truth for each concern.
 */
export function validateAction(params: { objective: string | null; hasUpstreamContext: boolean; actions: Action[]; dependencyIssues: ActionValidationIssue[] }): ActionValidationIssue[] {
  const { objective, hasUpstreamContext, actions, dependencyIssues } = params
  const issues: ActionValidationIssue[] = [...dependencyIssues]

  if (actions.length === 0) {
    issues.push({ kind: 'missing_actions', message: 'No actions were generated.', affectedIds: [] })
  }

  if (!objective && !hasUpstreamContext) {
    issues.push({ kind: 'missing_objective_or_context', message: 'No objective, plan, decision, or instruction context was available to ground this action set.', affectedIds: [] })
  }

  const idCounts = new Map<string, number>()
  for (const action of actions) idCounts.set(action.id, (idCounts.get(action.id) ?? 0) + 1)
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  if (duplicateIds.length > 0) {
    issues.push({ kind: 'duplicate_id', message: 'Two or more actions share the same id.', affectedIds: duplicateIds })
  }

  for (const action of actions) {
    if (ACTOR_REQUIRED_TYPES.has(action.type) && action.actor.type === 'unassigned') {
      issues.push({ kind: 'missing_actor', message: `Action "${action.title}" has no responsible actor identified.`, affectedIds: [action.id] })
    }

    // Self-consistency check on the already-computed readiness: a 'ready' action must have
    // no blockers/missing information, and any non-ready state must actually explain itself.
    const r = action.readiness
    const contradictory = (r.state === 'ready' && (r.blockers.length > 0 || r.missingInformation.length > 0)) || (r.state !== 'ready' && r.blockers.length === 0 && r.missingInformation.length === 0)
    if (contradictory) {
      issues.push({ kind: 'contradictory_readiness', message: `Action "${action.title}" has a readiness state that is not consistent with its own blockers/missing-information.`, affectedIds: [action.id] })
    }
  }

  return issues
}
