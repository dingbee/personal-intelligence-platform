import { classifyIntent } from '@/modules/intelligence/intent/intentClassifier'
import { selectResponseStrategy } from '@/modules/intelligence/strategy/responseStrategy'
import { PLANNING_RULES, FALLBACK_CONTEXT, CONTINUATION_CONTEXT } from '@/modules/intelligence/planner/planningRules'
import type { ContextRequirement, ReasoningPlan, ReasoningStrategy } from '@/modules/intelligence/planner/plannerTypes'

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

/** Merges requiredContext groups in first-seen order, deduplicated — used so fallback/continuation broadening only ever adds to a base intent's context, never drops anything it already specified. */
function mergeContext(...groups: ContextRequirement[][]): ContextRequirement[] {
  const seen = new Set<ContextRequirement>()
  const result: ContextRequirement[] = []
  for (const group of groups) {
    for (const value of group) {
      if (!seen.has(value)) {
        seen.add(value)
        result.push(value)
      }
    }
  }
  return result
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
  const classification = classifyIntent(params.text)
  const { intent } = classification
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

  // Retrieval Prerequisite Fix — 'ask' is only ever reached when
  // classifyIntent fell through every rule (see intentRules.ts: there is
  // no 'ask' rule), so it's always the low-confidence case. Its own
  // PLANNING_RULES row stays narrow (it's still the base "default"
  // shape), but here it's swapped for FALLBACK_CONTEXT — an explicit,
  // broader floor for "we genuinely don't know what this is" rather than
  // inheriting the narrowest row in the whole table.
  const isLowConfidenceFallback = classification.matchedRule === 'fallback-ask' || classification.matchedRule === 'empty-input'
  const baseContext = isLowConfidenceFallback ? FALLBACK_CONTEXT : base.requiredContext

  // A continuation only makes sense in light of the prior turn, so it
  // needs access to what that turn likely drew on — merged on top of
  // (never replacing) whatever the base/fallback context already is.
  const requiredContext = params.signals.isContinuation ? mergeContext(baseContext, CONTINUATION_CONTEXT) : baseContext

  return {
    intent,
    strategy,
    requiredContext,
    responseStrategy,
    suggestedCommandIds,
  }
}
