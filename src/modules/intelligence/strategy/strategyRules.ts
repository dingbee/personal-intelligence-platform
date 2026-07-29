import type { IntentType } from '@/modules/intelligence/intent/intentTypes'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'

/** UX-12 Phase 5 — the base intent -> response-strategy mapping. A fixed lookup table, same style as strategyRules/priorityEngine elsewhere in this module. */
export const BASE_STRATEGY_BY_INTENT: Record<IntentType, ResponseStrategyType> = {
  plan: 'planning',
  decide: 'decision',
  compare: 'comparison',
  organize: 'standard',
  create: 'standard',
  summarize: 'brief',
  analyze: 'exploratory',
  review: 'standard',
  continue: 'standard',
  teach: 'tutorial',
  learn: 'tutorial',
  search: 'brief',
  read: 'brief',
  explain: 'tutorial',
  ask: 'standard',
}

/** Words that upgrade a summarize/analyze-flavored message into an executive-summary strategy — a whole-workspace ask reads differently than "summarize this chapter." */
export const EXECUTIVE_SCOPE_MARKERS: RegExp[] = [/\beverything\b/i, /\boverview\b/i, /\bwhole workspace\b/i, /\ball my (documents|notes|conversations)\b/i]
