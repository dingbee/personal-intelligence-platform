import { describe, expect, it } from 'vitest'
import { validatePlan } from '@/modules/planning-intelligence/api/validatePlan'
import type { ParsedPlanFields } from '@/modules/planning-intelligence/api/parsePlanningResponse'

function baseFields(overrides: Partial<ParsedPlanFields> = {}): ParsedPlanFields {
  return {
    title: 'Plan',
    description: null,
    currentState: null,
    desiredOutcome: null,
    gapAnalysis: null,
    assumptions: [],
    constraints: [],
    objectives: [],
    workstreams: [],
    milestones: [],
    tasks: [{ id: 't1', title: 'A task', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
    resources: [],
    deadline: null,
    ...overrides,
  }
}

describe('validatePlan', () => {
  it('reports missing_objective for a blank objective', () => {
    const issues = validatePlan('   ', baseFields())
    expect(issues.some((i) => i.kind === 'missing_objective')).toBe(true)
  })

  it('does not report missing_objective for a real objective', () => {
    const issues = validatePlan('Launch the pricing page', baseFields())
    expect(issues.some((i) => i.kind === 'missing_objective')).toBe(false)
  })

  it('reports no_actionable_tasks when the plan has zero tasks', () => {
    const issues = validatePlan('Objective', baseFields({ tasks: [] }))
    expect(issues.some((i) => i.kind === 'no_actionable_tasks')).toBe(true)
  })

  it('is clean for a well-formed, internally-consistent plan', () => {
    const fields = baseFields({
      milestones: [{ id: 'm1', title: 'M1', description: '', target: null, targetDate: null, sequence: 1, dependsOnMilestoneIds: [] }],
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: 'm1', workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    })
    expect(validatePlan('Objective', fields)).toEqual([])
  })

  it('reports dangling_task_dependency when a task depends on a task id that does not exist', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: ['ghost'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'dangling_task_dependency' && i.affectedIds.includes('ghost'))).toBe(true)
  })

  it('reports dangling_milestone_dependency when a milestone depends on a milestone id that does not exist', () => {
    const fields = baseFields({ milestones: [{ id: 'm1', title: 'M1', description: '', target: null, targetDate: null, sequence: 1, dependsOnMilestoneIds: ['ghost'] }] })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'dangling_milestone_dependency' && i.affectedIds.includes('ghost'))).toBe(true)
  })

  it('reports dangling_milestone_reference when a task references a milestone id that does not exist', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: 'ghost', workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'dangling_milestone_reference' && i.affectedIds.includes('ghost'))).toBe(true)
  })

  it('detects a direct circular task dependency (A depends on B, B depends on A)', () => {
    const fields = baseFields({
      tasks: [
        { id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: ['t2'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
        { id: 't2', title: 'B', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t1'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
      ],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'circular_task_dependency')).toBe(true)
  })

  it('detects a longer circular task dependency chain (A -> B -> C -> A)', () => {
    const fields = baseFields({
      tasks: [
        { id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: ['t3'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
        { id: 't2', title: 'B', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t1'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
        { id: 't3', title: 'C', description: '', status: 'not_started', priority: 'medium', sequence: 3, dependsOnTaskIds: ['t2'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
      ],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.filter((i) => i.kind === 'circular_task_dependency')).toHaveLength(1)
  })

  it('detects a circular milestone dependency', () => {
    const fields = baseFields({
      milestones: [
        { id: 'm1', title: 'A', description: '', target: null, targetDate: null, sequence: 1, dependsOnMilestoneIds: ['m2'] },
        { id: 'm2', title: 'B', description: '', target: null, targetDate: null, sequence: 2, dependsOnMilestoneIds: ['m1'] },
      ],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'circular_milestone_dependency')).toBe(true)
  })

  it('does not flag a valid linear (non-circular) dependency chain', () => {
    const fields = baseFields({
      tasks: [
        { id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
        { id: 't2', title: 'B', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t1'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
        { id: 't3', title: 'C', description: '', status: 'not_started', priority: 'medium', sequence: 3, dependsOnTaskIds: ['t2'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
      ],
    })
    expect(validatePlan('Objective', fields).filter((i) => i.kind === 'circular_task_dependency')).toEqual([])
  })

  it('reports a self-referential task dependency as circular', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: ['t1'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'circular_task_dependency')).toBe(true)
  })

  it('reports dangling_workstream_reference when a task references a workstream that does not exist', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, workstreamId: 'ghost', estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'dangling_workstream_reference' && i.affectedIds.includes('ghost'))).toBe(true)
  })

  it('reports dangling_resource_reference when a task references a resource that does not exist', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [{ resourceId: 'ghost', amount: 1 }] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'dangling_resource_reference' && i.affectedIds.includes('ghost'))).toBe(true)
  })

  it('reports impossible_deadline when a milestone targetDate falls after the plan deadline', () => {
    const fields = baseFields({
      deadline: '2027-01-01',
      milestones: [{ id: 'm1', title: 'Too late', description: '', target: null, targetDate: '2027-02-01', sequence: 1, dependsOnMilestoneIds: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'impossible_deadline' && i.affectedIds.includes('m1'))).toBe(true)
  })

  it('does not report impossible_deadline when the milestone is within the plan deadline', () => {
    const fields = baseFields({
      deadline: '2027-03-01',
      milestones: [{ id: 'm1', title: 'On time', description: '', target: null, targetDate: '2027-02-01', sequence: 1, dependsOnMilestoneIds: [] }],
    })
    expect(validatePlan('Objective', fields).some((i) => i.kind === 'impossible_deadline')).toBe(false)
  })

  it('does not report impossible_deadline when neither the plan nor any milestone has a real date', () => {
    expect(validatePlan('Objective', baseFields()).some((i) => i.kind === 'impossible_deadline')).toBe(false)
  })

  it('reports milestone_timeline_inconsistency when a milestone targets an earlier date than a milestone it depends on', () => {
    const fields = baseFields({
      milestones: [
        { id: 'm1', title: 'Later prerequisite', description: '', target: null, targetDate: '2027-03-01', sequence: 1, dependsOnMilestoneIds: [] },
        { id: 'm2', title: 'Earlier dependent', description: '', target: null, targetDate: '2027-02-01', sequence: 2, dependsOnMilestoneIds: ['m1'] },
      ],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'milestone_timeline_inconsistency' && i.affectedIds.includes('m2') && i.affectedIds.includes('m1'))).toBe(true)
  })

  it('does not report milestone_timeline_inconsistency for a chronologically consistent chain', () => {
    const fields = baseFields({
      milestones: [
        { id: 'm1', title: 'First', description: '', target: null, targetDate: '2027-02-01', sequence: 1, dependsOnMilestoneIds: [] },
        { id: 'm2', title: 'Second', description: '', target: null, targetDate: '2027-03-01', sequence: 2, dependsOnMilestoneIds: ['m1'] },
      ],
    })
    expect(validatePlan('Objective', fields).some((i) => i.kind === 'milestone_timeline_inconsistency')).toBe(false)
  })

  it('reports resource_capacity_exceeded when two independent tasks together exceed a declared resource capacity', () => {
    const fields = baseFields({
      resources: [{ id: 'r1', name: 'Designer', kind: 'person', capacity: 1, unit: 'person', origin: 'known' }],
      tasks: [
        { id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [{ resourceId: 'r1', amount: 1 }] },
        { id: 't2', title: 'B', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [{ resourceId: 'r1', amount: 1 }] },
      ],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'resource_capacity_exceeded' && i.affectedIds.includes('r1'))).toBe(true)
  })

  it('does not report resource_capacity_exceeded when demand stays within declared capacity', () => {
    const fields = baseFields({
      resources: [{ id: 'r1', name: 'Designer', kind: 'person', capacity: 2, unit: 'person', origin: 'known' }],
      tasks: [{ id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [{ resourceId: 'r1', amount: 1 }] }],
    })
    expect(validatePlan('Objective', fields).some((i) => i.kind === 'resource_capacity_exceeded')).toBe(false)
  })

  it('reports orphan_task for a task with no milestone/workstream/dependency link, when the plan has more than one task', () => {
    const fields = baseFields({
      tasks: [
        { id: 't1', title: 'Connected', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: 'm1', workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
        { id: 't2', title: 'Floating', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
      ],
      milestones: [{ id: 'm1', title: 'M1', description: '', target: null, targetDate: null, sequence: 1, dependsOnMilestoneIds: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'orphan_task' && i.affectedIds.includes('t2'))).toBe(true)
    expect(issues.some((i) => i.kind === 'orphan_task' && i.affectedIds.includes('t1'))).toBe(false)
  })

  it('does not report orphan_task for the single task in a one-task plan', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'Solo', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    })
    expect(validatePlan('Objective', fields).some((i) => i.kind === 'orphan_task')).toBe(false)
  })

  it('does not report orphan_task for a task that other tasks depend on, even if it has no milestone/workstream itself', () => {
    const fields = baseFields({
      tasks: [
        { id: 't1', title: 'A prerequisite', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
        { id: 't2', title: 'B', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t1'], milestoneId: null, workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] },
      ],
    })
    expect(validatePlan('Objective', fields).some((i) => i.kind === 'orphan_task')).toBe(false)
  })

  it('reports unreachable_milestone when no task references a milestone that exists in the plan', () => {
    const fields = baseFields({
      milestones: [
        { id: 'm1', title: 'Reachable', description: '', target: null, targetDate: null, sequence: 1, dependsOnMilestoneIds: [] },
        { id: 'm2', title: 'Unreachable', description: '', target: null, targetDate: null, sequence: 2, dependsOnMilestoneIds: [] },
      ],
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: 'm1', workstreamId: null, estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'unreachable_milestone' && i.affectedIds.includes('m2'))).toBe(true)
    expect(issues.some((i) => i.kind === 'unreachable_milestone' && i.affectedIds.includes('m1'))).toBe(false)
  })
})
