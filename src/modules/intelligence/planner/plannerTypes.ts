import type { IntentType } from '@/modules/intelligence/intent/intentTypes'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'

export type ReasoningStrategy = 'single-step' | 'multi-step' | 'exploratory' | 'comparative' | 'decision'

/**
 * Existing context providers only — Reader Intelligence (UX-9), the RAG
 * document retriever, Memory (UX-5), Knowledge Graph Intelligence (UX-10),
 * recent conversations, and Workspace/Executive Intelligence (UX-11).
 * Nothing here names a new retrieval source.
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
