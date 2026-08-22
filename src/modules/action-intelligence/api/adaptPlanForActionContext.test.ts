import { describe, expect, it } from 'vitest'
import { adaptPlanForActionContext } from '@/modules/action-intelligence/api/adaptPlanForActionContext'
import type { Plan } from '@/modules/planning-intelligence/plan'

function basePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: 'University Launch Plan',
    objective: 'Launch ARRIYIA at the university',
    description: null,
    status: 'complete',
    currentState: null,
    desiredOutcome: null,
    gapAnalysis: null,
    assumptions: [],
    constraints: [{ id: 'con-1', constraint: 'No paid ads budget', type: 'budget', severity: 'hard', origin: 'known' }],
    objectives: [],
    workstreams: [],
    milestones: [{ id: 'm1', title: 'Beta cohort onboarded', description: '', target: null, targetDate: null, sequence: 1, dependsOnMilestoneIds: [] }],
    tasks: [{ id: 't1', title: 'Draft outreach email', description: '', milestoneId: null, workstreamId: null, sequence: 1, dependsOnTaskIds: [], status: 'not_started', priority: 'medium', estimatedEffort: null, requiredResources: [], resourceRequirements: [] }],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
    resources: [],
    deadline: null,
    criticalPath: [],
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

describe('adaptPlanForActionContext', () => {
  it("maps a Plan's title/objective/milestones/tasks/constraints into the action-context shape, one-way", () => {
    const plan = basePlan()
    const context = adaptPlanForActionContext(plan)

    expect(context).toEqual({
      planTitle: 'University Launch Plan',
      planObjective: 'Launch ARRIYIA at the university',
      relevantMilestones: ['Beta cohort onboarded'],
      relevantTasks: ['Draft outreach email'],
      relevantConstraints: ['No paid ads budget'],
    })
  })

  it('does not mutate or reference the original Plan object after mapping', () => {
    const plan = basePlan()
    const context = adaptPlanForActionContext(plan)
    plan.tasks.push({ id: 't2', title: 'A later task', description: '', milestoneId: null, workstreamId: null, sequence: 2, dependsOnTaskIds: [], status: 'not_started', priority: 'medium', estimatedEffort: null, requiredResources: [], resourceRequirements: [] })
    expect(context.relevantTasks).toEqual(['Draft outreach email'])
  })
})
