import { listWorkspaceObjectives } from '@/modules/hub/api/objectives'
import { gatherEvidence } from '@/modules/research-intelligence/gatherEvidence'
import type { PlanDerivedActionContext } from '@/modules/action-intelligence/api/adaptPlanForActionContext'
import type { DecisionDerivedActionContext } from '@/modules/action-intelligence/api/adaptDecisionForActionContext'
import type { ActionContextSource, ActionContextSourceType } from '@/modules/action-intelligence/action'

const MAX_WORKSPACE_OBJECTIVES = 5

export interface ActionContext {
  /** Explicit user instruction, when this action set is being generated directly from one (Phase 8, input D) — null when generation is driven entirely by an upstream Plan/Decision. */
  instruction: string | null
  objective: string | null
  userConstraints: string[]
  /** Kept with real ids (unlike Plan/Decision's own activeWorkspaceObjectives, which only needed content strings) — Action Intelligence lets a generated action reference one by number, resolved to its real id, so an 'objective'-kind ActionDependency is never a fabricated reference. */
  activeWorkspaceObjectives: { id: string; content: string }[]
  relevantEvidence: ActionContextSource[]
  planContext: PlanDerivedActionContext | null
  decisionContext: DecisionDerivedActionContext | null
}

/**
 * Selective context assembly for Action Intelligence — same discipline
 * as Planning/Decision Intelligence's own context builders: never a
 * full knowledge-base dump. Must work when only ONE of {plan, decision,
 * instruction} is supplied (Phase 8's four input combinations: decision
 * alone, plan alone, both, or explicit instruction alone) — every field
 * here is independently optional, and the retrieval query below degrades
 * gracefully to whatever's actually available rather than requiring all
 * three.
 */
export async function buildActionContext(params: {
  instruction?: string | null
  objective?: string | null
  userConstraints?: string[]
  userId: string
  workspaceId: string | null
  planContext?: PlanDerivedActionContext | null
  decisionContext?: DecisionDerivedActionContext | null
}): Promise<ActionContext> {
  const { instruction = null, objective = null, userConstraints = [], userId, workspaceId, planContext = null, decisionContext = null } = params

  const retrievalQuery = [instruction, objective, planContext?.planObjective, decisionContext?.decisionQuestion].filter((s): s is string => Boolean(s)).join(' ')

  const [activeObjectives, evidence] = await Promise.all([
    workspaceId ? listWorkspaceObjectives(workspaceId) : Promise.resolve([]),
    retrievalQuery ? gatherEvidence({ query: retrievalQuery, userId, workspaceId }) : Promise.resolve([]),
  ])

  return {
    instruction,
    objective,
    userConstraints,
    activeWorkspaceObjectives: activeObjectives
      .filter((o) => o.status === 'active')
      .slice(0, MAX_WORKSPACE_OBJECTIVES)
      .map((o) => ({ id: o.id, content: o.content })),
    // gatherEvidence's source types are 'document'|'note'|'asset'|'dataset_investigation' — 'dataset_investigation'
    // is only ever constructed by Research Intelligence's own orchestration, never by a plain gatherEvidence call.
    relevantEvidence: evidence.map((e) => ({ id: e.id, type: e.source.type as ActionContextSourceType, title: e.source.title, excerpt: e.excerpt })),
    planContext,
    decisionContext,
  }
}
