import { classifyIntent } from '@/modules/intelligence/intent/intentClassifier'
import { selectResponseStrategy } from '@/modules/intelligence/strategy/responseStrategy'
import { PLANNING_RULES } from '@/modules/intelligence/planner/planningRules'
import type { ReasoningPlan, ReasoningStrategy } from '@/modules/intelligence/planner/plannerTypes'

export interface PlannerSignals {
  /** From CommandContext.inProgressDocument (already resolved, no new fetch) — gates whether "Continue reading" is a real suggestion this turn. */
  hasInProgressDocument: boolean
  /** From contextTrace.memoriesUsed > 0 (already computed by AIService this turn). */
  hasMemoryContext: boolean
  /** From contextTrace.graphNodes > 0 (already computed by AIService this turn). */
  hasGraphContext: boolean
  /** From isContinuationMessage (UX-6, already used by the main orchestrator). */
  isContinuation: boolean
}

/**
 * UX-12 Phase 3 — the Reasoning Planner. Performs no AI work: it combines
 * the deterministic intent classification with this turn's already-
 * resolved signals and a fixed rule table (planningRules.ts) to decide a
 * reasoning strategy, required context, response strategy, and
 * suggestions. Every input signal here is something the caller (ChatPage)
 * already has in scope — no new fetch is introduced by this function.
 */
export function buildReasoningPlan(params: { text: string; signals: PlannerSignals }): ReasoningPlan {
  const { intent } = classifyIntent(params.text)
  const base = PLANNING_RULES[intent]
  const responseStrategy = selectResponseStrategy(intent, params.text)

  const suggestedCommandIds = base.suggestedCommandIds.filter(
    (id) => id !== 'reader-continue' || params.signals.hasInProgressDocument,
  )

  // A continuation message inherits the ongoing conversation's own
  // trajectory rather than restarting a fresh single-step plan — same
  // signal (isContinuationMessage) the main orchestrator (UX-8) already
  // uses to prioritize context sources.
  const strategy: ReasoningStrategy =
    params.signals.isContinuation && base.strategy === 'single-step' ? 'multi-step' : base.strategy

  return {
    intent,
    strategy,
    requiredContext: base.requiredContext,
    responseStrategy,
    suggestedCommandIds,
  }
}
