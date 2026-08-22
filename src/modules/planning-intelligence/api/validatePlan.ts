import { computePlanSchedule } from '@/modules/planning-intelligence/api/computePlanSchedule'
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
 *
 * I6 addition — timeline and resource checks, both over REAL structured
 * data only (ISO dates, declared resource capacities), never over the
 * free-text fields a human wrote in prose: checkTimeline() compares
 * `deadline`/`targetDate` chronologically; checkResourceCapacity()
 * delegates to computePlanSchedule.ts's own wave-scheduling arithmetic
 * rather than reimplementing it.
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
  const workstreamIds = new Set(fields.workstreams.map((w) => w.id))
  const resourceIds = new Set(fields.resources.map((r) => r.id))

  for (const task of fields.tasks) {
    for (const depId of task.dependsOnTaskIds) {
      if (!taskIds.has(depId)) {
        issues.push({ kind: 'dangling_task_dependency', message: `Task "${task.title}" depends on a task that does not exist in this plan.`, affectedIds: [task.id, depId] })
      }
    }
    if (task.milestoneId && !milestoneIds.has(task.milestoneId)) {
      issues.push({ kind: 'dangling_milestone_reference', message: `Task "${task.title}" references a milestone that does not exist in this plan.`, affectedIds: [task.id, task.milestoneId] })
    }
    if (task.workstreamId && !workstreamIds.has(task.workstreamId)) {
      issues.push({ kind: 'dangling_workstream_reference', message: `Task "${task.title}" references a workstream that does not exist in this plan.`, affectedIds: [task.id, task.workstreamId] })
    }
    for (const req of task.resourceRequirements) {
      if (!resourceIds.has(req.resourceId)) {
        issues.push({ kind: 'dangling_resource_reference', message: `Task "${task.title}" references a resource that does not exist in this plan.`, affectedIds: [task.id, req.resourceId] })
      }
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

  issues.push(...checkTimeline(fields))
  issues.push(...checkResourceCapacity(fields))
  issues.push(...checkOrphanTasks(fields))
  issues.push(...checkUnreachableMilestones(fields))

  return issues
}

/** A task with no milestone, no workstream, no dependency in either direction — nothing in the plan's own structure connects it to anything else. Skipped entirely for a single-task plan (there is nothing to be disconnected FROM). */
function checkOrphanTasks(fields: ParsedPlanFields): PlanValidationIssue[] {
  if (fields.tasks.length <= 1) return []
  const dependedOnIds = new Set(fields.tasks.flatMap((t) => t.dependsOnTaskIds))

  return fields.tasks
    .filter((t) => !t.milestoneId && !t.workstreamId && t.dependsOnTaskIds.length === 0 && !dependedOnIds.has(t.id))
    .map((t) => ({ kind: 'orphan_task' as const, message: `Task "${t.title}" has no milestone, workstream, or dependency link to the rest of the plan.`, affectedIds: [t.id] }))
}

/** A milestone no task actually references via milestoneId — structurally, nothing in the plan will ever complete it. */
function checkUnreachableMilestones(fields: ParsedPlanFields): PlanValidationIssue[] {
  if (fields.tasks.length === 0) return []
  const referencedMilestoneIds = new Set(fields.tasks.map((t) => t.milestoneId).filter((id): id is string => id !== null))

  return fields.milestones
    .filter((m) => !referencedMilestoneIds.has(m.id))
    .map((m) => ({ kind: 'unreachable_milestone' as const, message: `Milestone "${m.title}" has no task that contributes to it.`, affectedIds: [m.id] }))
}

/**
 * Chronological feasibility — only ever compares REAL structured dates
 * (`deadline`/`targetDate`), never the free-text `target`/constraint
 * prose (there is nothing deterministic to check a sentence against).
 * A plan with no real dates at all produces no timeline issues — that is
 * the honest answer, not a false "clean" one, since there is nothing to
 * validate.
 */
function checkTimeline(fields: ParsedPlanFields): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = []
  const milestoneById = new Map(fields.milestones.map((m) => [m.id, m]))

  if (fields.deadline) {
    for (const m of fields.milestones) {
      if (m.targetDate && m.targetDate > fields.deadline) {
        issues.push({ kind: 'impossible_deadline', message: `Milestone "${m.title}" targets ${m.targetDate}, after the plan's own deadline of ${fields.deadline}.`, affectedIds: [m.id] })
      }
    }
  }

  for (const m of fields.milestones) {
    if (!m.targetDate) continue
    for (const depId of m.dependsOnMilestoneIds) {
      const dep = milestoneById.get(depId)
      if (dep?.targetDate && m.targetDate < dep.targetDate) {
        issues.push({
          kind: 'milestone_timeline_inconsistency',
          message: `Milestone "${m.title}" targets ${m.targetDate}, before milestone "${dep.title}" (${dep.targetDate}) that it depends on.`,
          affectedIds: [m.id, dep.id],
        })
      }
    }
  }

  return issues
}

/** Delegates the actual wave/resource-usage arithmetic to computePlanSchedule.ts (the same function runPlanningIntelligence.ts uses for Plan.criticalPath) rather than reimplementing it — this function only translates its result into PlanValidationIssues. */
function checkResourceCapacity(fields: ParsedPlanFields): PlanValidationIssue[] {
  const { resourceUsage } = computePlanSchedule(fields.tasks, fields.resources)
  const resourceById = new Map(fields.resources.map((r) => [r.id, r]))

  return resourceUsage
    .filter((u) => u.exceeded)
    .map((u) => ({
      kind: 'resource_capacity_exceeded' as const,
      message: `Concurrent demand for "${resourceById.get(u.resourceId)?.name ?? u.resourceId}" (${u.required}${resourceById.get(u.resourceId)?.unit ? ` ${resourceById.get(u.resourceId)!.unit}` : ''}) exceeds its declared capacity of ${u.capacity}.`,
      affectedIds: [u.resourceId],
    }))
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
