import type { PlanResource, PlanTask } from '@/modules/planning-intelligence/plan'

/**
 * Deterministic task scheduling — never trusted from the model. There is
 * no real numeric task duration anywhere in the Plan contract (see
 * PlanTask.estimatedEffort's own doc comment: free text or null, never a
 * fabricated number), so true Critical Path Method arithmetic (duration-
 * weighted earliest/latest start) isn't honestly computable. What IS
 * honestly computable from the dependency graph alone is an "earliest
 * possible wave" schedule — the same idea CPM's own forward pass uses,
 * just with every task's assumed duration equal to 1: a task's wave is
 * one more than the latest wave among the tasks it depends on. The
 * critical path is then the longest chain of waves — the real
 * bottleneck of the plan's structure, independent of any duration
 * estimate.
 *
 * A cyclic dependency graph has no valid schedule at all — validatePlan.ts
 * already reports the cycle itself; this function just refuses to
 * fabricate a wave/critical-path/resource-usage result for a graph it
 * can't actually schedule, returning empty/null rather than guessing.
 */

export interface PlanTaskWave {
  taskId: string
  wave: number
}

export interface PlanResourceWaveUsage {
  wave: number
  resourceId: string
  required: number
  capacity: number | null
  exceeded: boolean
}

export interface PlanScheduleResult {
  /** One entry per task, only present when the graph is acyclic. */
  taskWaves: PlanTaskWave[]
  /** The task ids forming the longest dependency chain, in order — empty when the graph is cyclic or there are no tasks. */
  criticalPath: string[]
  /** Per-wave, per-resource demand vs declared capacity — only for resources with a real numeric capacity; a resource with capacity: null has nothing to check against and is silently skipped, never treated as violated. */
  resourceUsage: PlanResourceWaveUsage[]
}

const EMPTY_RESULT: PlanScheduleResult = { taskWaves: [], criticalPath: [], resourceUsage: [] }

/** Computes each task's wave via memoized DFS over dependsOnTaskIds; returns null if a cycle is encountered (dangling references are treated as no-ops, exactly like validatePlan.ts's own cycle detection over dependency ids present in the task set). */
function computeWaves(tasks: PlanTask[]): Map<string, number> | null {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const wave = new Map<string, number>()
  const state = new Map<string, 'visiting' | 'done'>()

  function visit(id: string): number {
    const cached = wave.get(id)
    if (cached !== undefined) return cached
    if (state.get(id) === 'visiting') throw new Error('cycle')
    state.set(id, 'visiting')

    const task = byId.get(id)
    const deps = task ? task.dependsOnTaskIds.filter((d) => byId.has(d)) : []
    const w = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((d) => visit(d)))

    wave.set(id, w)
    state.set(id, 'done')
    return w
  }

  try {
    for (const t of tasks) visit(t.id)
  } catch {
    return null
  }
  return wave
}

/** Walks backward from the task(s) with the maximum wave, at each step choosing the lexicographically-smallest-id dependency that actually achieves `wave - 1` — deterministic and reproducible when multiple chains tie for longest. */
function reconstructCriticalPath(tasks: PlanTask[], waveById: Map<string, number>): string[] {
  if (tasks.length === 0) return []
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const maxWave = Math.max(...[...waveById.values()])
  const endTaskId = [...waveById.entries()]
    .filter(([, w]) => w === maxWave)
    .map(([id]) => id)
    .sort()[0]!

  const path: string[] = [endTaskId]
  let current = endTaskId
  let currentWave = maxWave
  while (currentWave > 0) {
    const task = byId.get(current)!
    const nextId = task.dependsOnTaskIds
      .filter((d) => byId.has(d) && waveById.get(d) === currentWave - 1)
      .sort()[0]
    if (!nextId) break
    path.unshift(nextId)
    current = nextId
    currentWave -= 1
  }
  return path
}

function computeResourceUsage(tasks: PlanTask[], resources: PlanResource[], waveById: Map<string, number>): PlanResourceWaveUsage[] {
  const resourceById = new Map(resources.map((r) => [r.id, r]))
  // demand[wave][resourceId] = total amount requested by tasks in that wave
  const demand = new Map<number, Map<string, number>>()

  for (const task of tasks) {
    const wave = waveById.get(task.id)
    if (wave === undefined) continue
    for (const req of task.resourceRequirements) {
      if (!resourceById.has(req.resourceId)) continue
      const byResource = demand.get(wave) ?? new Map<string, number>()
      byResource.set(req.resourceId, (byResource.get(req.resourceId) ?? 0) + req.amount)
      demand.set(wave, byResource)
    }
  }

  const usage: PlanResourceWaveUsage[] = []
  for (const [wave, byResource] of [...demand.entries()].sort((a, b) => a[0] - b[0])) {
    for (const [resourceId, required] of [...byResource.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const resource = resourceById.get(resourceId)!
      if (resource.capacity === null) continue
      usage.push({ wave, resourceId, required, capacity: resource.capacity, exceeded: required > resource.capacity })
    }
  }
  return usage
}

export function computePlanSchedule(tasks: PlanTask[], resources: PlanResource[]): PlanScheduleResult {
  if (tasks.length === 0) return EMPTY_RESULT

  const waveById = computeWaves(tasks)
  if (!waveById) return EMPTY_RESULT

  const taskWaves: PlanTaskWave[] = tasks.map((t) => ({ taskId: t.id, wave: waveById.get(t.id)! }))
  const criticalPath = reconstructCriticalPath(tasks, waveById)
  const resourceUsage = computeResourceUsage(tasks, resources, waveById)

  return { taskWaves, criticalPath, resourceUsage }
}
