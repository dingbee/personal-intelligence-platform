import type { Plan } from '@/modules/planning-intelligence/plan'

/**
 * Decision Intelligence -> Planning Intelligence, one-way adapter (Phase
 * 14 of the sprint brief: "use typed interfaces/adapters... Planning
 * must continue working independently"). This is the ONLY file in
 * decision-intelligence/ that imports from planning-intelligence/ — the
 * core Decision domain model (decision.ts) has no dependency on Plan at
 * all, so Planning Intelligence's own types/behavior are completely
 * unaffected by anything in this module (mirrors exactly how the
 * provenance adapters map each engine's own shape outward without ever
 * being imported back by the engine itself).
 */
export interface PlanDerivedDecisionContext {
  planTitle: string
  planObjective: string
  relevantMilestones: string[]
  relevantConstraints: string[]
  relevantRisks: string[]
  relevantAssumptions: string[]
}

export function adaptPlanForDecisionContext(plan: Plan): PlanDerivedDecisionContext {
  return {
    planTitle: plan.title,
    planObjective: plan.objective,
    relevantMilestones: plan.milestones.map((m) => m.title),
    relevantConstraints: plan.constraints.map((c) => c.constraint),
    relevantRisks: plan.risks.map((r) => r.risk),
    relevantAssumptions: plan.assumptions.map((a) => a.statement),
  }
}
