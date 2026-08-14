import { listWorkspaceObjectives } from '@/modules/hub/api/objectives'
import { gatherEvidence } from '@/modules/research-intelligence/gatherEvidence'
import type { PlanDerivedDecisionContext } from '@/modules/decision-intelligence/api/adaptPlanForDecisionContext'
import type { DecisionContextSource, DecisionContextSourceType } from '@/modules/decision-intelligence/decision'

const MAX_WORKSPACE_OBJECTIVES = 5

export interface DecisionContext {
  question: string
  objective: string | null
  userConstraints: string[]
  activeWorkspaceObjectives: string[]
  relevantEvidence: DecisionContextSource[]
  /** Set only when the caller passed an originating Plan — see adaptPlanForDecisionContext.ts. Null for a standalone decision with no planning context. */
  planContext: PlanDerivedDecisionContext | null
}

/**
 * Selective context assembly for Decision Intelligence — same
 * discipline as Planning Intelligence's own buildPlanningContext.ts
 * (never a full knowledge-base dump): active workspace objectives, one
 * bounded gatherEvidence retrieval pass against the decision question,
 * and — when the caller is deciding in service of an existing plan
 * (Phase 14) — that plan's own objective/milestones/constraints/risks/
 * assumptions, via the one-way adaptPlanForDecisionContext.ts mapping.
 *
 * Research/Analysis investigation reuse ("relevant analysis results
 * where already available," brief Phase 3) is not wired here: neither
 * engine persists its results anywhere today (both live for one request
 * only, per their own orchestration functions' doc comments), so there
 * is nothing real to fetch without fabricating a source — same
 * limitation Planning Intelligence's own context assembly already
 * documented, carried forward honestly rather than worked around.
 */
export async function buildDecisionContext(params: {
  question: string
  objective?: string | null
  userConstraints?: string[]
  userId: string
  workspaceId: string | null
  plan?: PlanDerivedDecisionContext | null
}): Promise<DecisionContext> {
  const { question, objective = null, userConstraints = [], userId, workspaceId, plan = null } = params

  const [activeObjectives, evidence] = await Promise.all([
    workspaceId ? listWorkspaceObjectives(workspaceId) : Promise.resolve([]),
    gatherEvidence({ query: objective ? `${question} ${objective}` : question, userId, workspaceId }),
  ])

  return {
    question,
    objective,
    userConstraints,
    activeWorkspaceObjectives: activeObjectives
      .filter((o) => o.status === 'active')
      .slice(0, MAX_WORKSPACE_OBJECTIVES)
      .map((o) => o.content),
    // gatherEvidence's source types are 'document'|'note'|'asset'|'dataset_investigation' — 'dataset_investigation'
    // is only ever constructed by Research Intelligence's own orchestration, never by a plain gatherEvidence call.
    relevantEvidence: evidence.map((e) => ({ id: e.id, type: e.source.type as DecisionContextSourceType, title: e.source.title, excerpt: e.excerpt })),
    planContext: plan,
  }
}
