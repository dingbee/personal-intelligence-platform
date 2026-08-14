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
    milestones: [],
    tasks: [{ id: 't1', title: 'A task', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, estimatedEffort: null, requiredResources: [] }],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
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
      milestones: [{ id: 'm1', title: 'M1', description: '', target: null, sequence: 1, dependsOnMilestoneIds: [] }],
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: 'm1', estimatedEffort: null, requiredResources: [] }],
    })
    expect(validatePlan('Objective', fields)).toEqual([])
  })

  it('reports dangling_task_dependency when a task depends on a task id that does not exist', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: ['ghost'], milestoneId: null, estimatedEffort: null, requiredResources: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'dangling_task_dependency' && i.affectedIds.includes('ghost'))).toBe(true)
  })

  it('reports dangling_milestone_dependency when a milestone depends on a milestone id that does not exist', () => {
    const fields = baseFields({ milestones: [{ id: 'm1', title: 'M1', description: '', target: null, sequence: 1, dependsOnMilestoneIds: ['ghost'] }] })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'dangling_milestone_dependency' && i.affectedIds.includes('ghost'))).toBe(true)
  })

  it('reports dangling_milestone_reference when a task references a milestone id that does not exist', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'T1', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: 'ghost', estimatedEffort: null, requiredResources: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'dangling_milestone_reference' && i.affectedIds.includes('ghost'))).toBe(true)
  })

  it('detects a direct circular task dependency (A depends on B, B depends on A)', () => {
    const fields = baseFields({
      tasks: [
        { id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: ['t2'], milestoneId: null, estimatedEffort: null, requiredResources: [] },
        { id: 't2', title: 'B', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t1'], milestoneId: null, estimatedEffort: null, requiredResources: [] },
      ],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'circular_task_dependency')).toBe(true)
  })

  it('detects a longer circular task dependency chain (A -> B -> C -> A)', () => {
    const fields = baseFields({
      tasks: [
        { id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: ['t3'], milestoneId: null, estimatedEffort: null, requiredResources: [] },
        { id: 't2', title: 'B', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t1'], milestoneId: null, estimatedEffort: null, requiredResources: [] },
        { id: 't3', title: 'C', description: '', status: 'not_started', priority: 'medium', sequence: 3, dependsOnTaskIds: ['t2'], milestoneId: null, estimatedEffort: null, requiredResources: [] },
      ],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.filter((i) => i.kind === 'circular_task_dependency')).toHaveLength(1)
  })

  it('detects a circular milestone dependency', () => {
    const fields = baseFields({
      milestones: [
        { id: 'm1', title: 'A', description: '', target: null, sequence: 1, dependsOnMilestoneIds: ['m2'] },
        { id: 'm2', title: 'B', description: '', target: null, sequence: 2, dependsOnMilestoneIds: ['m1'] },
      ],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'circular_milestone_dependency')).toBe(true)
  })

  it('does not flag a valid linear (non-circular) dependency chain', () => {
    const fields = baseFields({
      tasks: [
        { id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: [], milestoneId: null, estimatedEffort: null, requiredResources: [] },
        { id: 't2', title: 'B', description: '', status: 'not_started', priority: 'medium', sequence: 2, dependsOnTaskIds: ['t1'], milestoneId: null, estimatedEffort: null, requiredResources: [] },
        { id: 't3', title: 'C', description: '', status: 'not_started', priority: 'medium', sequence: 3, dependsOnTaskIds: ['t2'], milestoneId: null, estimatedEffort: null, requiredResources: [] },
      ],
    })
    expect(validatePlan('Objective', fields).filter((i) => i.kind === 'circular_task_dependency')).toEqual([])
  })

  it('reports a self-referential task dependency as circular', () => {
    const fields = baseFields({
      tasks: [{ id: 't1', title: 'A', description: '', status: 'not_started', priority: 'medium', sequence: 1, dependsOnTaskIds: ['t1'], milestoneId: null, estimatedEffort: null, requiredResources: [] }],
    })
    const issues = validatePlan('Objective', fields)
    expect(issues.some((i) => i.kind === 'circular_task_dependency')).toBe(true)
  })
})
