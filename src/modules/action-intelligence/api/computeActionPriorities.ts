import type { ActionPriority } from '@/modules/action-intelligence/action'
import type { ParsedAction } from '@/modules/action-intelligence/api/parseActionResponse'

const RANK: Record<ActionPriority, number> = { low: 0, medium: 1, high: 2 }
const LEVELS: ActionPriority[] = ['low', 'medium', 'high']

/**
 * Deterministic prioritization (sprint brief Phase 6). The model's own
 * `priority` is the base signal (already validated/defaulted by
 * parseActionResponse.ts) — this function only ever adjusts it upward,
 * by two independent, explainable, real structural rules, each capped
 * at 'high':
 *
 *   1. Blocking impact — an action other actions actually depend on
 *      (real graph fact, not inferred) is bumped one level, since
 *      delaying it delays everything waiting on it.
 *   2. Deadline proximity where explicitly known — an action with a
 *      genuine `dueHint` (never a fabricated deadline; see Action's own
 *      doc comment) is bumped one level. This is a presence check, not
 *      a computed "days remaining": dueHint is free text, not a real
 *      date, so there is nothing to compute proximity FROM without
 *      inventing precision the input never had.
 *
 * An action with neither signal keeps its declared priority exactly —
 * this function never demotes, and never invents urgency from vague
 * language (the sprint's own explicit prohibition).
 */
export function computeActionPriorities(actions: ParsedAction[]): Map<string, ActionPriority> {
  const blockingCounts = new Map<string, number>()
  for (const action of actions) {
    for (const dep of action.dependencies) {
      if (dep.kind === 'action' && dep.targetId) {
        blockingCounts.set(dep.targetId, (blockingCounts.get(dep.targetId) ?? 0) + 1)
      }
    }
  }

  const result = new Map<string, ActionPriority>()
  for (const action of actions) {
    let rank = RANK[action.priority]
    if ((blockingCounts.get(action.id) ?? 0) > 0) rank = Math.min(2, rank + 1)
    if (action.dueHint) rank = Math.min(2, rank + 1)
    result.set(action.id, LEVELS[rank]!)
  }
  return result
}
