import { describe, expect, it } from 'vitest'
import { adaptPlanForDecisionContext } from '@/modules/decision-intelligence/api/adaptPlanForDecisionContext'
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
    tasks: [],
    risks: [{ id: 'r1', risk: 'Low awareness', probability: 'medium', impact: 'medium', mitigation: null, contingency: null }],
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

describe('adaptPlanForDecisionContext', () => {
  it('maps a Plan\'s title/objective/milestones/constraints/risks/assumptions into the decision-context shape, one-way', () => {
    const plan = basePlan()
    const context = adaptPlanForDecisionContext(plan)

    expect(context).toEqual({
      planTitle: 'University Launch Plan',
      planObjective: 'Launch ARRIYIA at the university',
      relevantMilestones: ['Beta cohort onboarded'],
      relevantConstraints: ['No paid ads budget'],
      relevantRisks: ['Low awareness'],
      relevantAssumptions: [],
    })
  })

  it('does not mutate or reference the original Plan object after mapping', () => {
    const plan = basePlan()
    const context = adaptPlanForDecisionContext(plan)
    plan.milestones.push({ id: 'm2', title: 'A later milestone', description: '', target: null, targetDate: null, sequence: 2, dependsOnMilestoneIds: [] })
    // The already-produced context is a plain snapshot — it doesn't share array identity with the live Plan.
    expect(context.relevantMilestones).toEqual(['Beta cohort onboarded'])
  })
})
