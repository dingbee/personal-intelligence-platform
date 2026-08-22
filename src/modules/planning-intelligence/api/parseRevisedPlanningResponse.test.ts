import { describe, expect, it } from 'vitest'
import { parseRevisedPlanningResponse } from '@/modules/planning-intelligence/api/parseRevisedPlanningResponse'
import type { Plan } from '@/modules/planning-intelligence/plan'

function json(obj: unknown): string {
  return JSON.stringify(obj)
}

function basePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: 'Original Plan',
    objective: 'Launch the thing',
    description: null,
    status: 'complete',
    currentState: null,
    desiredOutcome: null,
    gapAnalysis: null,
    assumptions: [],
    constraints: [],
    objectives: [],
    workstreams: [{ id: 'ws-1', title: 'Design', description: '' }],
    milestones: [{ id: 'm-1', title: 'Design done', description: '', target: null, targetDate: null, sequence: 1, dependsOnMilestoneIds: [] }],
    tasks: [
      { id: 't-1', title: 'Draft copy', description: '', status: 'completed', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: 'm-1', workstreamId: 'ws-1', estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
      { id: 't-2', title: 'Build page', description: '', status: 'in_progress', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t-1'], milestoneId: 'm-1', workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
    ],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
    resources: [{ id: 'r-1', name: 'Designer', kind: 'person', capacity: 1, unit: 'person', origin: 'known' }],
    deadline: '2027-03-01',
    criticalPath: ['t-1', 't-2'],
    contextEvidence: [],
    workspaceId: 'workspace-1',
    createdAt: new Date().toISOString(),
    validationIssues: [],
    revisionOf: null,
    revisionReason: null,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    ...overrides,
  }
}

describe('parseRevisedPlanningResponse', () => {
  it('returns invalid for non-JSON text', () => {
    expect(parseRevisedPlanningResponse('not json', basePlan()).status).toBe('invalid')
  })

  it('returns declined when the model reports the change cannot be applied', () => {
    const result = parseRevisedPlanningResponse(json({ declined: true, reason: 'Not a real change.' }), basePlan())
    expect(result).toEqual({ status: 'declined', reason: 'Not a real change.' })
  })

  it('reuses the ORIGINAL real id when the model echoes it back as localId — the core preservation guarantee', () => {
    const original = basePlan()
    const result = parseRevisedPlanningResponse(
      json({
        title: 'Revised Plan',
        milestones: [{ localId: 'm-1', title: 'Design done', description: '', sequence: 1, dependsOn: [] }],
        tasks: [{ localId: 't-1', title: 'Draft copy', description: '', priority: 'medium', sequence: 1, dependsOn: [], milestoneId: 'm-1' }],
      }),
      original,
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.milestones[0]!.id).toBe('m-1')
    expect(result.plan.tasks[0]!.id).toBe('t-1')
  })

  it('preserves an unaffected task\'s real progress status rather than resetting it to not_started', () => {
    const original = basePlan()
    const result = parseRevisedPlanningResponse(
      json({ title: 'Revised Plan', tasks: [{ localId: 't-2', title: 'Build page', description: '', priority: 'medium', sequence: 1, dependsOn: [] }] }),
      original,
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.tasks[0]!.id).toBe('t-2')
    expect(result.plan.tasks[0]!.status).toBe('in_progress')
  })

  it('mints a genuinely fresh id for a localId that does not match any real original id', () => {
    const original = basePlan()
    const result = parseRevisedPlanningResponse(
      json({ title: 'Revised Plan', tasks: [{ localId: 'brand-new-task', title: 'A new task', description: '', priority: 'medium', sequence: 1, dependsOn: [] }] }),
      original,
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.tasks[0]!.id).not.toBe('brand-new-task')
    expect(result.plan.tasks[0]!.status).toBe('not_started') // a genuinely new task has no prior status to preserve
  })

  it('reuses real workstream/resource ids the same way as milestones/tasks', () => {
    const original = basePlan()
    const result = parseRevisedPlanningResponse(
      json({
        title: 'Revised Plan',
        workstreams: [{ localId: 'ws-1', title: 'Design', description: '' }],
        resources: [{ localId: 'r-1', name: 'Designer', kind: 'person', capacity: 1 }],
      }),
      original,
    )
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.workstreams[0]!.id).toBe('ws-1')
    expect(result.plan.resources[0]!.id).toBe('r-1')
  })

  it('does NOT reuse a localId that merely LOOKS like it could be an id but was never one of this plan\'s own ids', () => {
    const original = basePlan()
    const result = parseRevisedPlanningResponse(json({ title: 'Revised Plan', milestones: [{ localId: 'm-999-not-real', title: 'Fake', description: '', sequence: 1, dependsOn: [] }] }), original)
    expect(result.status).toBe('plan')
    if (result.status !== 'plan') return
    expect(result.plan.milestones[0]!.id).not.toBe('m-999-not-real')
  })
})
