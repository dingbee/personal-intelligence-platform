import type { ActionReadiness, ActionReadinessState } from '@/modules/action-intelligence/action'
import type { ParsedAction } from '@/modules/action-intelligence/api/parseActionResponse'
import type { DependencyAnalysis } from '@/modules/action-intelligence/api/analyzeActionDependencies'

/**
 * Deterministic readiness evaluation — the sprint's own core
 * differentiator (Phase 4): "The LLM may propose actions, but it must
 * NOT decide whether an action is structurally ready by itself." This
 * function never reads any "ready" claim from the model at all —
 * parseActionResponse.ts doesn't even parse one (see ParsedAction's own
 * doc comment) — every readiness state here is derived purely from real
 * structural facts: the dependency graph's own computed state, and
 * whether a responsible actor was actually identified.
 *
 * Processes actions in `dependencyAnalysis.processingOrder` (built by
 * analyzeActionDependencies.ts) so a dependent action's readiness is
 * always computed strictly after whatever it depends on — an action
 * inside a dependency cycle is conservatively evaluated as 'blocked'
 * (never 'ready'), since no real ordering exists to resolve it safely.
 */
export function computeActionReadiness(actions: ParsedAction[], dependencyAnalysis: DependencyAnalysis): Map<string, ActionReadiness> {
  const byId = new Map(actions.map((a) => [a.id, a]))
  const titleById = new Map(actions.map((a) => [a.id, a.title]))
  const readinessById = new Map<string, ActionReadiness>()

  for (const id of dependencyAnalysis.processingOrder) {
    const action = byId.get(id)
    if (!action) continue

    if (action.type === 'decision_required') {
      readinessById.set(id, { state: 'needs_decision', blockers: ['This action IS the decision that needs to be made — it has not been resolved yet.'], missingInformation: [] })
      continue
    }
    if (action.type === 'information_request') {
      readinessById.set(id, { state: 'needs_information', blockers: [], missingInformation: ['This action is itself an information request and has not yet been answered.'] })
      continue
    }

    if (dependencyAnalysis.cyclicActionIds.has(id)) {
      readinessById.set(id, { state: 'blocked', blockers: ['This action is part of a circular dependency and cannot be safely sequenced.'], missingInformation: [] })
      continue
    }

    const blockers: string[] = []
    const missingInformation: string[] = []
    let hasDecisionBlocker = false
    let readyDependencyCount = 0
    let actionDependencyCount = 0

    for (const dep of action.dependencies) {
      if (dep.kind === 'decision') {
        hasDecisionBlocker = true
        blockers.push(`Unresolved decision: ${dep.description}`)
      } else if (dep.kind === 'action' && dep.targetId) {
        actionDependencyCount += 1
        const depReadiness = readinessById.get(dep.targetId)
        if (depReadiness?.state === 'ready') {
          readyDependencyCount += 1
        } else {
          blockers.push(`Waiting on: ${dep.description || titleById.get(dep.targetId) || 'a prerequisite action'}`)
        }
      }
      // 'objective' dependencies are informational context, not a readiness blocker —
      // an action can reference a workspace objective it supports without waiting on it.
    }

    if (action.actor.type === 'unassigned') {
      missingInformation.push('No responsible actor identified')
    }

    let state: ActionReadinessState
    if (hasDecisionBlocker) {
      state = 'needs_decision'
    } else if (missingInformation.length > 0) {
      state = 'needs_information'
    } else if (blockers.length > 0) {
      state = actionDependencyCount > 0 && readyDependencyCount > 0 ? 'partially_ready' : 'blocked'
    } else {
      state = 'ready'
    }

    readinessById.set(id, { state, blockers, missingInformation })
  }

  return readinessById
}
