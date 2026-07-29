import type { IntentType } from '@/modules/intelligence/intent/intentTypes'
import { BASE_STRATEGY_BY_INTENT, EXECUTIVE_SCOPE_MARKERS } from '@/modules/intelligence/strategy/strategyRules'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'

/**
 * UX-12 Phase 5 — pure intent -> response strategy selection. Deliberately
 * separate from the existing responseStyle.ts (UX-6), which is already
 * wired into buildNovaContextPrompt inside AIService.sendMessage: this
 * phase's STOP RULE forbids touching "existing AIService provider logic,"
 * so ResponseStrategyType is a richer, display-only classification for the
 * Reasoning Trace/Chat UI (Phase 9/10) rather than a replacement for the
 * 3-value ResponseStyleHint actually driving prompt text today. See the
 * phase report's architecture decisions.
 */
export function selectResponseStrategy(intent: IntentType, text: string): ResponseStrategyType {
  const base = BASE_STRATEGY_BY_INTENT[intent]
  if ((intent === 'summarize' || intent === 'analyze') && EXECUTIVE_SCOPE_MARKERS.some((marker) => marker.test(text))) {
    return 'executive_summary'
  }
  return base
}

const STRATEGY_DESCRIPTIONS: Record<ResponseStrategyType, string> = {
  brief: 'A short, direct answer.',
  standard: 'A clear, complete answer without padding.',
  exploratory: 'An open-ended exploration with room to develop ideas.',
  tutorial: 'A step-by-step explanation suited to learning.',
  decision: 'A structured decision: options, trade-offs, and a recommendation.',
  comparison: 'A side-by-side comparison of the things being weighed.',
  planning: 'A multi-step plan broken into concrete actions.',
  executive_summary: 'A high-level summary across your whole workspace.',
}

export function describeResponseStrategy(strategy: ResponseStrategyType): string {
  return STRATEGY_DESCRIPTIONS[strategy]
}
