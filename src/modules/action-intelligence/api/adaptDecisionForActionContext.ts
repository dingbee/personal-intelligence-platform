import type { Decision } from '@/modules/decision-intelligence/decision'

/**
 * Action Intelligence -> Decision Intelligence, one-way adapter (Phase
 * 8 of the sprint brief), mirroring adaptPlanForActionContext.ts. The
 * ONLY file in action-intelligence/ that imports from
 * decision-intelligence/ — Decision itself has no dependency on Action
 * Intelligence.
 */
export interface DecisionDerivedActionContext {
  /** The real Decision.id this context was built from — I7 addition, see ActionSource's own doc comment (action.ts) on why this closes a genuine DECISION -> ACTION traceability gap. Never fabricated. */
  decisionId: string
  decisionQuestion: string
  /** The recommended alternative's title, or null when the decision was declined/failed/has no resolved recommendation — Action Intelligence never invents a recommendation to act on. */
  recommendedAlternative: string | null
  rationale: string | null
  nextAction: string | null
  relevantRisks: string[]
  /** True when the upstream Decision itself was provisional (see Decision.provisional) — carried through so Action Intelligence doesn't present downstream actions with more certainty than the decision that produced them actually had. */
  provisional: boolean
}

export function adaptDecisionForActionContext(decision: Decision): DecisionDerivedActionContext {
  const recommended = decision.alternatives.find((a) => a.id === decision.recommendedAlternativeId) ?? null
  return {
    decisionId: decision.id,
    decisionQuestion: decision.question,
    recommendedAlternative: recommended?.title ?? null,
    rationale: decision.rationale,
    nextAction: decision.nextAction,
    relevantRisks: decision.risks.map((r) => r.description),
    provisional: decision.provisional,
  }
}
