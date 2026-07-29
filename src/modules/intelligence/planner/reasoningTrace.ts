import type { ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import type { IntentType } from '@/modules/intelligence/intent/intentTypes'
import type { ContextSelection } from '@/modules/intelligence/planner/contextSelector'
import type { ReasoningPlan } from '@/modules/intelligence/planner/plannerTypes'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'
import type { DecisionFramework } from '@/modules/intelligence/decision/decisionTypes'
import type { LearningIntelligence } from '@/modules/intelligence/learning/learningTypes'

/**
 * UX-12 Phase 9 — extends the existing ContextTrace (UX-5.2/UX-6, built
 * inside AIService.sendMessage) with the new reasoning fields the brief
 * asks for: Intent, Planner, Response Strategy, Selected Context, Decision
 * Framework, Learning Mode. Built at the caller (ChatPage/useSendMessage),
 * never inside AIService.sendMessage or buildContextTrace.ts itself — both
 * stay untouched, per the STOP RULE. `intent`/`responseStrategy` are also
 * reachable via `planner.intent`/`planner.responseStrategy`; they're
 * projected onto their own top-level fields too so the trace shape
 * matches the brief's six named fields directly, not because there's a
 * second source of truth for them.
 */
export interface ReasoningTrace extends ContextTrace {
  intent: IntentType
  planner: ReasoningPlan
  responseStrategy: ResponseStrategyType
  selectedContext: ContextSelection
  decisionFramework: DecisionFramework | null
  learningMode: LearningIntelligence | null
}

export function buildReasoningTrace(params: {
  contextTrace: ContextTrace
  plan: ReasoningPlan
  selectedContext: ContextSelection
  decisionFramework: DecisionFramework | null
  learningMode: LearningIntelligence | null
}): ReasoningTrace {
  return {
    ...params.contextTrace,
    intent: params.plan.intent,
    planner: params.plan,
    responseStrategy: params.plan.responseStrategy,
    selectedContext: params.selectedContext,
    decisionFramework: params.decisionFramework,
    learningMode: params.learningMode,
  }
}
