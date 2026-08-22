import { describe, expect, it } from 'vitest'
import { computePlanSchedule } from '@/modules/planning-intelligence/api/computePlanSchedule'
import type { PlanResource, PlanTask } from '@/modules/planning-intelligence/plan'

function task(overrides: Partial<PlanTask> & { id: string }): PlanTask {
  return {
    title: overrides.id,
    description: '',
    status: 'not_started',
    priority: 'medium',
    sequence: 1,
    dependsOnTaskIds: [],
    milestoneId: null,
    workstreamId: null,
    estimatedEffort: null,
    requiredResources: [],
    resourceRequirements: [],
    ...overrides,
  }
}

function resource(overrides: Partial<PlanResource> & { id: string; name: string }): PlanResource {
  return { kind: 'person', capacity: null, unit: null, origin: 'known', ...overrides }
}

describe('computePlanSchedule', () => {
  it('returns an empty result for zero tasks', () => {
    expect(computePlanSchedule([], [])).toEqual({ taskWaves: [], criticalPath: [], resourceUsage: [] })
  })

  it('assigns wave 0 to every task with no dependencies', () => {
    const tasks = [task({ id: 't1' }), task({ id: 't2' })]
    const result = computePlanSchedule(tasks, [])
    expect(result.taskWaves).toEqual(expect.arrayContaining([{ taskId: 't1', wave: 0 }, { taskId: 't2', wave: 0 }]))
  })

  it('computes waves along a linear chain A -> B -> C', () => {
    const tasks = [
      task({ id: 't1', dependsOnTaskIds: [] }),
      task({ id: 't2', dependsOnTaskIds: ['t1'] }),
      task({ id: 't3', dependsOnTaskIds: ['t2'] }),
    ]
    const result = computePlanSchedule(tasks, [])
    const waveById = new Map(result.taskWaves.map((w) => [w.taskId, w.wave]))
    expect(waveById.get('t1')).toBe(0)
    expect(waveById.get('t2')).toBe(1)
    expect(waveById.get('t3')).toBe(2)
    expect(result.criticalPath).toEqual(['t1', 't2', 't3'])
  })

  it('a task with two dependencies takes the wave of its LATEST dependency, not the earliest', () => {
    // t1 -> t3, t2 -> t3, but t2 itself depends on t0 (so t2 is wave 1, t1 is wave 0)
    const tasks = [
      task({ id: 't0' }),
      task({ id: 't1' }),
      task({ id: 't2', dependsOnTaskIds: ['t0'] }),
      task({ id: 't3', dependsOnTaskIds: ['t1', 't2'] }),
    ]
    const result = computePlanSchedule(tasks, [])
    const waveById = new Map(result.taskWaves.map((w) => [w.taskId, w.wave]))
    expect(waveById.get('t3')).toBe(2) // max(wave(t1)=0, wave(t2)=1) + 1
  })

  it('the critical path is the longest chain, not an arbitrary one, when branches of different lengths exist', () => {
    // Short branch: t1 -> t4. Long branch: t1 -> t2 -> t3 -> t4.
    const tasks = [
      task({ id: 't1' }),
      task({ id: 't2', dependsOnTaskIds: ['t1'] }),
      task({ id: 't3', dependsOnTaskIds: ['t2'] }),
      task({ id: 't4', dependsOnTaskIds: ['t1', 't3'] }),
    ]
    const result = computePlanSchedule(tasks, [])
    expect(result.criticalPath).toEqual(['t1', 't2', 't3', 't4'])
  })

  it('returns an empty schedule (never a fabricated one) when the dependency graph is cyclic', () => {
    const tasks = [task({ id: 't1', dependsOnTaskIds: ['t2'] }), task({ id: 't2', dependsOnTaskIds: ['t1'] })]
    const result = computePlanSchedule(tasks, [])
    expect(result).toEqual({ taskWaves: [], criticalPath: [], resourceUsage: [] })
  })

  it('ignores a dangling dependency id (not in the task set) rather than crashing', () => {
    const tasks = [task({ id: 't1', dependsOnTaskIds: ['ghost'] })]
    const result = computePlanSchedule(tasks, [])
    expect(result.taskWaves).toEqual([{ taskId: 't1', wave: 0 }])
  })

  it('flags resource_capacity_exceeded when two concurrent (same-wave) tasks together exceed a resource capacity', () => {
    const resources = [resource({ id: 'r1', name: 'Designer', capacity: 1, unit: 'person' })]
    const tasks = [
      task({ id: 't1', resourceRequirements: [{ resourceId: 'r1', amount: 1 }] }),
      task({ id: 't2', resourceRequirements: [{ resourceId: 'r1', amount: 1 }] }), // same wave (0), independent of t1
    ]
    const result = computePlanSchedule(tasks, resources)
    expect(result.resourceUsage).toEqual([{ wave: 0, resourceId: 'r1', required: 2, capacity: 1, exceeded: true }])
  })

  it('does not flag when concurrent demand is within capacity', () => {
    const resources = [resource({ id: 'r1', name: 'Designer', capacity: 2, unit: 'person' })]
    const tasks = [
      task({ id: 't1', resourceRequirements: [{ resourceId: 'r1', amount: 1 }] }),
      task({ id: 't2', resourceRequirements: [{ resourceId: 'r1', amount: 1 }] }),
    ]
    const result = computePlanSchedule(tasks, resources)
    expect(result.resourceUsage[0]!.exceeded).toBe(false)
  })

  it('does not flag when the same demand is spread across different waves (sequential, not concurrent)', () => {
    const resources = [resource({ id: 'r1', name: 'Designer', capacity: 1, unit: 'person' })]
    const tasks = [
      task({ id: 't1', resourceRequirements: [{ resourceId: 'r1', amount: 1 }] }),
      task({ id: 't2', dependsOnTaskIds: ['t1'], resourceRequirements: [{ resourceId: 'r1', amount: 1 }] }),
    ]
    const result = computePlanSchedule(tasks, resources)
    expect(result.resourceUsage.every((u) => !u.exceeded)).toBe(true)
  })

  it('never checks a resource with no declared capacity — silently skipped, not treated as violated', () => {
    const resources = [resource({ id: 'r1', name: 'Goodwill', capacity: null })]
    const tasks = [task({ id: 't1', resourceRequirements: [{ resourceId: 'r1', amount: 100 }] })]
    const result = computePlanSchedule(tasks, resources)
    expect(result.resourceUsage).toEqual([])
  })

  it('ignores a resourceRequirement referencing a resource id that is not in the declared resource list', () => {
    const tasks = [task({ id: 't1', resourceRequirements: [{ resourceId: 'ghost-resource', amount: 5 }] })]
    const result = computePlanSchedule(tasks, [])
    expect(result.resourceUsage).toEqual([])
  })
})
