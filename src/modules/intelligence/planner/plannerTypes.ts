import type { IntentType } from '@/modules/intelligence/intent/intentTypes'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'

export type ReasoningStrategy = 'single-step' | 'multi-step' | 'exploratory' | 'comparative' | 'decision'

/**
 * Existing context providers only — Reader Intelligence (UX-9), the RAG
 * document retriever, Memory (UX-5), Knowledge Graph Intelligence (UX-10),
 * recent conversations, and Workspace/Executive Intelligence (UX-11).
 * Nothing here names a new retrieval source.
 *
 * Retrieval Prerequisite Fix — deliberately does NOT include assets or
 * spreadsheet data, both real AIService.sendMessage retrieval sources
 * (retrieveAssetContext / retrieveSpreadsheetContext):
 *   - Images (retrieveAssetContext): none of IntentType's 15 buckets
 *     correlates with "this turn is about an image" by wording — unlike
 *     documents/notes/memory/knowledge_graph, there is no deterministic
 *     text signal to gate on, so adding an 'assets' value here would be a
 *     guess, not a real signal. Left for a future workstream if/when a
 *     real signal exists (e.g. an image actually attached to the turn).
 *   - Spreadsheets (retrieveSpreadsheetContext): already gated by
 *     `documentId` plus persisted structured-analysis availability (see
 *     that function) — a real data-availability check, strictly more
 *     precise than anything a text-based intent guess could offer. A
 *     requiredContext value here would only duplicate an existing correct
 *     gate, never improve it.
 */
export type ContextRequirement =
  | 'documents'
  | 'reading_progress'
  | 'notes'
  | 'flashcards'
  | 'memory'
  | 'knowledge_graph'
  | 'recent_conversations'
  | 'workspace_overview'

export interface ReasoningPlan {
  intent: IntentType
  strategy: ReasoningStrategy
  requiredContext: ContextRequirement[]
  responseStrategy: ResponseStrategyType
  /** Existing command registry ids only (see planningRules.ts) — the planner never invents a new action. A consumer resolves these against the live registry and silently skips any id that isn't registered. */
  suggestedCommandIds: string[]
}

export interface PlanPreviewStep {
  order: number
  description: string
}
