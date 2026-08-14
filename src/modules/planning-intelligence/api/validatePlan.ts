import type { ParsedPlanFields } from '@/modules/planning-intelligence/api/parsePlanningResponse'
import type { PlanValidationIssue } from '@/modules/planning-intelligence/plan'

/**
 * Deterministic structural validation — the brief's own requirement ("Do
 * not rely on the LLM alone to validate its own output"). Operates on
 * the already-parsed plan fields as the sole source of truth: it does
 * NOT re-trust parsePlanningResponse.ts to have already filtered
 * dangling references correctly, since a validator's whole point is to
 * be an independent check, not an assumption that an earlier step got it
 * right.
 *
 * What this deliberately does NOT (and structurally cannot) validate:
 * whether an "assumption" the model produced is honestly assumed rather
 * than quietly fabricated as fact elsewhere in the plan, or whether a
 * "known" fact is actually true — that requires semantic judgment no
 * deterministic pass can perform. This function only checks internal
 * structural coherence (references resolve, no cycles, the plan has
 * actionable content) — see the final report's BACKLOG note on this
 * limit.
 */
export function validatePlan(objective: string, fields: ParsedPlanFields): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = []

  if (!objective.trim()) {
    issues.push({ kind: 'missing_objective', message: 'The plan has no objective.', affectedIds: [] })
  }

  if (fields.tasks.length === 0) {
    issues.push({ kind: 'no_actionable_tasks', message: 'The plan contains no actionable tasks.', affectedIds: [] })
  }

  const taskIds = new Set(fields.tasks.map((t) => t.id))
  const milestoneIds = new Set(fields.milestones.map((m) => m.id))

  for (const task of fields.tasks) {
    for (const depId of task.dependsOnTaskIds) {
      if (!taskIds.has(depId)) {
        issues.push({ kind: 'dangling_task_dependency', message: `Task "${task.title}" depends on a task that does not exist in this plan.`, affectedIds: [task.id, depId] })
      }
    }
    if (task.milestoneId && !milestoneIds.has(task.milestoneId)) {
      issues.push({ kind: 'dangling_milestone_reference', message: `Task "${task.title}" references a milestone that does not exist in this plan.`, affectedIds: [task.id, task.milestoneId] })
    }
  }

  for (const milestone of fields.milestones) {
    for (const depId of milestone.dependsOnMilestoneIds) {
      if (!milestoneIds.has(depId)) {
        issues.push({ kind: 'dangling_milestone_dependency', message: `Milestone "${milestone.title}" depends on a milestone that does not exist in this plan.`, affectedIds: [milestone.id, depId] })
      }
    }
  }

  issues.push(...findCycles(fields.tasks.map((t) => [t.id, t.dependsOnTaskIds.filter((d) => taskIds.has(d))] as const), fields.tasks, 'circular_task_dependency'))
  issues.push(...findCycles(fields.milestones.map((m) => [m.id, m.dependsOnMilestoneIds.filter((d) => milestoneIds.has(d))] as const), fields.milestones, 'circular_milestone_dependency'))

  return issues
}

/** Standard white/gray/black DFS cycle detection over an id -> dependency-ids graph. Reports each distinct cycle once (by its sorted node set) even if reachable via multiple paths. */
function findCycles(edges: readonly (readonly [string, string[]])[], nodes: { id: string; title: string }[], kind: PlanValidationIssue['kind']): PlanValidationIssue[] {
  const graph = new Map(edges)
  const titleById = new Map(nodes.map((n) => [n.id, n.title]))
  const state = new Map<string, 'visiting' | 'done'>()
  const issues: PlanValidationIssue[] = []
  const reportedCycles = new Set<string>()

  function visit(id: string, path: string[]) {
    const status = state.get(id)
    if (status === 'done') return
    if (status === 'visiting') {
      const cycleStart = path.indexOf(id)
      const cycle = path.slice(cycleStart)
      const key = [...cycle].sort().join('|')
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key)
        issues.push({
          kind,
          message: `Circular dependency: ${cycle.map((cId) => titleById.get(cId) ?? cId).join(' → ')} → ${titleById.get(cycle[0]!) ?? cycle[0]}.`,
          affectedIds: cycle,
        })
      }
      return
    }
    state.set(id, 'visiting')
    for (const depId of graph.get(id) ?? []) {
      visit(depId, [...path, id])
    }
    state.set(id, 'done')
  }

  for (const [id] of edges) visit(id, [])
  return issues
}
