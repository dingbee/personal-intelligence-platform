import type { ContextRequirement } from '@/modules/intelligence/planner/plannerTypes'

const ALL_CONTEXT_SOURCES: ContextRequirement[] = [
  'documents',
  'reading_progress',
  'notes',
  'flashcards',
  'memory',
  'knowledge_graph',
  'recent_conversations',
  'workspace_overview',
]

export interface ContextSelection {
  included: ContextRequirement[]
  skipped: ContextRequirement[]
}

/**
 * UX-12 Phase 4 — the Context Selection Engine. Reuses existing context
 * providers only (Reader Intelligence, RAG document retrieval, Memory,
 * Knowledge Graph Intelligence, Workspace/Executive Intelligence) and adds
 * no new retrieval path.
 *
 * Important: this is a decision/observability layer, not a retrieval
 * gate. retrieveContext/retrieveGraphContext/retrieveMemoryContext inside
 * AIService.sendMessage always run exactly as they do today — actually
 * skipping them based on `skipped` below would require changing
 * AIService.ts, which this phase's STOP RULE forbids. `included`/`skipped`
 * are surfaced in the Reasoning Trace and Plan Preview so the reasoning
 * *shown* to the user matches the reasoning *requirement* the planner
 * computed, while the underlying retrieval stays untouched. See the phase
 * report's architecture decisions for the full explanation.
 */
export function selectContext(required: ContextRequirement[]): ContextSelection {
  const includedSet = new Set(required)
  return {
    included: ALL_CONTEXT_SOURCES.filter((source) => includedSet.has(source)),
    skipped: ALL_CONTEXT_SOURCES.filter((source) => !includedSet.has(source)),
  }
}
