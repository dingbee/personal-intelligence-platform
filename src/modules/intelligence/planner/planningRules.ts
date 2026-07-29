import type { IntentType } from '@/modules/intelligence/intent/intentTypes'
import type { ContextRequirement, ReasoningStrategy } from '@/modules/intelligence/planner/plannerTypes'

export interface PlanningRule {
  strategy: ReasoningStrategy
  requiredContext: ContextRequirement[]
  /**
   * Real command ids only — either already registered in commandRegistry
   * (see registerBuiltInCommands.ts) or 'reader-continue', the one
   * per-instance factory (buildContinueReadingCommand) every other reuse
   * of this module already special-cases the same way (suggestionEngine.ts,
   * graphSuggestions.ts). No new command is invented here.
   */
  suggestedCommandIds: string[]
}

/**
 * UX-12 Phase 3/4 — the base reasoning plan per intent, before planner.ts
 * refines it against this turn's actual signals (e.g. only include
 * reading_progress when a document is genuinely in progress). A fixed
 * lookup table, same style as strategyRules.ts/priorityEngine.ts.
 */
export const PLANNING_RULES: Record<IntentType, PlanningRule> = {
  ask: { strategy: 'single-step', requiredContext: ['documents'], suggestedCommandIds: [] },
  explain: { strategy: 'single-step', requiredContext: ['documents', 'knowledge_graph'], suggestedCommandIds: ['knowledge-explore'] },
  compare: { strategy: 'comparative', requiredContext: ['documents', 'knowledge_graph'], suggestedCommandIds: ['knowledge-explore'] },
  search: { strategy: 'single-step', requiredContext: ['documents'], suggestedCommandIds: ['search-open'] },
  learn: {
    strategy: 'multi-step',
    requiredContext: ['reading_progress', 'notes', 'flashcards', 'recent_conversations'],
    suggestedCommandIds: ['reader-continue'],
  },
  teach: { strategy: 'multi-step', requiredContext: ['documents', 'knowledge_graph'], suggestedCommandIds: ['knowledge-explore'] },
  summarize: { strategy: 'single-step', requiredContext: ['documents'], suggestedCommandIds: [] },
  analyze: { strategy: 'exploratory', requiredContext: ['documents', 'knowledge_graph'], suggestedCommandIds: ['dashboard-open'] },
  decide: { strategy: 'decision', requiredContext: ['documents', 'knowledge_graph', 'memory'], suggestedCommandIds: ['memory-manage'] },
  plan: { strategy: 'multi-step', requiredContext: ['documents', 'notes', 'recent_conversations'], suggestedCommandIds: ['dashboard-open'] },
  read: { strategy: 'single-step', requiredContext: ['reading_progress'], suggestedCommandIds: ['reader-continue'] },
  review: { strategy: 'single-step', requiredContext: ['notes', 'reading_progress'], suggestedCommandIds: ['memory-review-suggestions'] },
  continue: { strategy: 'single-step', requiredContext: ['reading_progress', 'recent_conversations'], suggestedCommandIds: ['reader-continue'] },
  create: { strategy: 'single-step', requiredContext: ['documents', 'notes'], suggestedCommandIds: ['notes-create'] },
  organize: { strategy: 'single-step', requiredContext: ['documents'], suggestedCommandIds: ['nav-library'] },
}
