import type { ActionValidationIssue } from '@/modules/action-intelligence/action'
import type { ParsedAction } from '@/modules/action-intelligence/api/parseActionResponse'

export interface DependencyAnalysis {
  issues: ActionValidationIssue[]
  /** Action ids that participate in a circular action-dependency — computeActionReadiness.ts treats these conservatively as 'blocked' rather than attempting to resolve an inherently unresolvable ordering. */
  cyclicActionIds: Set<string>
  /** A safe processing order (topological where possible) for computeActionReadiness.ts to iterate in — actions with no unresolved action-dependencies come first, so a dependent's readiness is always computed after what it depends on. Actions inside a cycle are appended at the end, in their original order, since no true topological position exists for them. */
  processingOrder: string[]
}

/**
 * Deterministic dependency-graph analysis (sprint brief Phase 5) —
 * bounded, in-memory, no graph database, exactly as instructed. Reused
 * DFS cycle-detection pattern from validatePlan.ts's own findCycles,
 * applied only to 'action'-kind dependency edges ('decision'/'objective'
 * dependencies aren't part of the action-to-action graph — they're
 * handled directly by computeActionReadiness.ts).
 */
export function analyzeActionDependencies(actions: ParsedAction[]): DependencyAnalysis {
  const issues: ActionValidationIssue[] = []
  const actionIds = new Set(actions.map((a) => a.id))
  const titleById = new Map(actions.map((a) => [a.id, a.title]))

  const graph = new Map<string, string[]>()
  for (const action of actions) {
    const edges: string[] = []
    for (const dep of action.dependencies) {
      if (dep.kind !== 'action') continue
      if (!dep.targetId || !actionIds.has(dep.targetId)) {
        issues.push({ kind: 'dangling_action_dependency', message: `Action "${action.title}" depends on an action that does not exist in this set.`, affectedIds: [action.id, dep.targetId ?? 'unknown'] })
        continue
      }
      edges.push(dep.targetId)
    }
    graph.set(action.id, edges)
  }

  for (const action of actions) {
    for (const dep of action.dependencies) {
      if (dep.kind === 'objective' && (!dep.targetId || dep.targetId.trim().length === 0)) {
        issues.push({ kind: 'dangling_objective_dependency', message: `Action "${action.title}" references a workspace objective that could not be resolved.`, affectedIds: [action.id] })
      }
    }
  }

  const cyclicActionIds = new Set<string>()
  const state = new Map<string, 'visiting' | 'done'>()
  const reportedCycles = new Set<string>()

  function visit(id: string, path: string[]) {
    const status = state.get(id)
    if (status === 'done') return
    if (status === 'visiting') {
      const cycleStart = path.indexOf(id)
      const cycle = path.slice(cycleStart)
      cycle.forEach((cId) => cyclicActionIds.add(cId))
      const key = [...cycle].sort().join('|')
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key)
        issues.push({
          kind: 'circular_dependency',
          message: `Circular dependency: ${cycle.map((cId) => titleById.get(cId) ?? cId).join(' → ')} → ${titleById.get(cycle[0]!) ?? cycle[0]}.`,
          affectedIds: cycle,
        })
      }
      return
    }
    state.set(id, 'visiting')
    for (const depId of graph.get(id) ?? []) visit(depId, [...path, id])
    state.set(id, 'done')
  }

  for (const action of actions) visit(action.id, [])

  // Topological order via a second, simpler pass: repeatedly take any not-yet-placed,
  // non-cyclic action whose action-dependencies are all already placed.
  const processingOrder: string[] = []
  const placed = new Set<string>()
  const nonCyclic = actions.filter((a) => !cyclicActionIds.has(a.id))
  let progress = true
  while (progress && placed.size < nonCyclic.length) {
    progress = false
    for (const action of nonCyclic) {
      if (placed.has(action.id)) continue
      const deps = graph.get(action.id) ?? []
      if (deps.every((d) => placed.has(d) || cyclicActionIds.has(d))) {
        processingOrder.push(action.id)
        placed.add(action.id)
        progress = true
      }
    }
  }
  // Anything left over (shouldn't happen for non-cyclic nodes given the loop above, but
  // defensive) plus every cyclic action, appended at the end in original order.
  for (const action of actions) {
    if (!placed.has(action.id)) processingOrder.push(action.id)
  }

  return { issues, cyclicActionIds, processingOrder }
}
