import type { ContextRequirement, PlanPreviewStep, ReasoningPlan } from '@/modules/intelligence/planner/plannerTypes'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'

const CONTEXT_STEP_DESCRIPTIONS: Record<ContextRequirement, string> = {
  documents: 'Review relevant documents',
  reading_progress: 'Check your reading progress',
  notes: 'Review your notes',
  flashcards: 'Check your flashcards',
  memory: 'Consider what NOVA remembers about you',
  knowledge_graph: 'Analyze your knowledge graph',
  recent_conversations: 'Compare previous conversations',
  workspace_overview: 'Review your workspace overview',
}

const FINAL_STEP_BY_STRATEGY: Record<ResponseStrategyType, string> = {
  brief: 'Answer directly',
  standard: 'Answer your question',
  exploratory: 'Explore the topic in depth',
  tutorial: 'Walk through it step by step',
  decision: 'Generate a recommendation',
  comparison: 'Generate a comparison',
  planning: 'Generate recommendations',
  executive_summary: 'Generate a workspace-wide summary',
}

/**
 * UX-12 Phase 8 — Plan Preview. Pure templating over the already-decided
 * ReasoningPlan (no new decision-making here) into the numbered, human-
 * readable steps shown in the Chat UI. This is metadata describing which
 * existing systems will be consulted, never a rendering of the model's
 * actual chain-of-thought.
 */
export function buildPlanPreview(plan: ReasoningPlan): PlanPreviewStep[] {
  const descriptions = [...plan.requiredContext.map((source) => CONTEXT_STEP_DESCRIPTIONS[source]), FINAL_STEP_BY_STRATEGY[plan.responseStrategy]]
  return descriptions.map((description, index) => ({ order: index + 1, description }))
}
