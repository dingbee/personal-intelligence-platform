import type { Plan } from '@/modules/planning-intelligence/plan'

/**
 * Action Intelligence -> Planning Intelligence, one-way adapter (Phase
 * 8 of the sprint brief), mirroring decision-intelligence's own
 * adaptPlanForDecisionContext.ts exactly. This is the ONLY file in
 * action-intelligence/ that imports from planning-intelligence/ — Plan
 * itself has no dependency on Action Intelligence and is completely
 * unaffected by anything here.
 */
export interface PlanDerivedActionContext {
  /** The real Plan.id this context was built from — I7 addition, see ActionSource's own doc comment (plan.ts) on why this closes a genuine PLAN -> ACTION traceability gap. Never fabricated. */
  planId: string
  planTitle: string
  planObjective: string
  relevantMilestones: string[]
  relevantTasks: string[]
  relevantConstraints: string[]
}

export function adaptPlanForActionContext(plan: Plan): PlanDerivedActionContext {
  return {
    planId: plan.id,
    planTitle: plan.title,
    planObjective: plan.objective,
    relevantMilestones: plan.milestones.map((m) => m.title),
    relevantTasks: plan.tasks.map((t) => t.title),
    relevantConstraints: plan.constraints.map((c) => c.constraint),
  }
}
