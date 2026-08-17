import type { IntentType } from '@/modules/intelligence/intent/intentTypes'
import type { ContextRequirement, ReasoningStrategy } from '@/modules/intelligence/planner/plannerTypes'

export interface PlanningRule {
  strategy: ReasoningStrategy
  requiredContext: ContextRequirement[]
  /**
   * Real command ids only — either already registered in commandRegistry
   * (see registerBuiltInCommands.ts) or 'reader-continue', the one
   * per-instance factory (buildContinueReadingCommand) every other reuse
   * of this module already special-cases the same way (recommendationEngine.ts,
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

/**
 * Retrieval Prerequisite Fix — the requiredContext floor used instead of
 * PLANNING_RULES.ask's own (narrow) row when classifyIntent could not
 * confidently match a rule (matchedRule === 'fallback-ask' or
 * 'empty-input' — 'ask' is never reached any other way, see
 * intentRules.ts, which has no 'ask' rule). A low-confidence
 * classification should not aggressively narrow what the model can see —
 * ARRIYIA being uncertain what the user means is exactly the case that
 * calls for preserving more context, not less.
 *
 * Deliberately just documents + memory + knowledge_graph: these are the
 * three PLANNING_RULES already treats as broadly, cheaply useful
 * (documents is the RAG baseline every confident intent keeps; memory and
 * knowledge_graph are each backed by their own retrieval functions'
 * documented "cheap, no embedding call, safe to include" contracts — see
 * retrieveMemoryContext.ts / retrieveNamedEntityGraphContext.ts). `notes`
 * is deliberately left out: no stronger code evidence ties it to the
 * uncertain/fallback case specifically than to any other intent.
 */
export const FALLBACK_CONTEXT: ContextRequirement[] = ['documents', 'memory', 'knowledge_graph']

/**
 * Retrieval Prerequisite Fix — additional requiredContext values merged
 * in (never replacing the base intent's own row) when
 * isContinuationMessage judged this turn a continuation of the prior one.
 * A continuation only makes sense in light of what came before, so it
 * needs access to what that prior turn likely drew on.
 *
 * `recent_conversations` and `reading_progress` don't correspond to any
 * of AIService's six Promise.all retrieval sources — they describe
 * resolveNovaContext's always-on activityContext (inProgressDocument /
 * recentConversations), a separate pipeline this workstream does not
 * touch. Naming them here is consistent with how PLANNING_RULES already
 * uses both values for the `continue`/`read`/`learn`/`plan` rows, and
 * keeps the Reasoning Trace's stated requirement honest even though
 * nothing changes about how or whether they're fetched.
 */
export const CONTINUATION_CONTEXT: ContextRequirement[] = ['documents', 'memory', 'recent_conversations', 'reading_progress']
