import type { ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import type { EvidenceLevel } from '@/modules/intelligence/evidence/computeEvidenceScore'
import type { Command } from '@/modules/commands/types'

export type ContextSourceKey =
  | 'continuation'
  | 'workspace'
  | 'reading'
  | 'memory'
  | 'graph'
  | 'timeline'
  | 'recentConversations'
  | 'genericWorkspace'

/** Phase 2 — a ranked source, always carrying WHY it was ranked/selected (the brief's explicit requirement). */
export interface ContextSourceDecision {
  key: ContextSourceKey
  score: number
  present: boolean
  reason: string
}

export type AttentionType =
  | 'unfinished_book'
  | 'stopped_midway'
  | 'asked_before'
  | 'contradictory_memories'
  | 'inactive_workspace'
  // UX-11 Phase 6 additions (dashboard-only sources, composed by dashboardSignals.ts):
  | 'disconnected_concept'
  | 'knowledge_island'

export type AttentionPriority = 'high' | 'medium' | 'low'

/** Phase 3 — informational, never auto-acted-on. `priority` added in UX-11 Phase 6 for the Attention Center's High/Medium/Low grouping — assigned by detectAttentionItems per type, existing callers that don't render it are unaffected. */
export interface AttentionItem {
  type: AttentionType
  message: string
  priority: AttentionPriority
}

export type ResurfacedKnowledgeType = 'document' | 'note' | 'conversation'

/** Phase 4 — "you might want to look at this again," resolved from existing metadata only. */
export interface ResurfacedKnowledgeItem {
  type: ResurfacedKnowledgeType
  id: string
  title: string
  href: string
}

export type WorkspaceInsightType = 'most_active' | 'least_active' | 'largest_library' | 'recent_uploads' | 'most_queried_topic'

/** Phase 5 — deterministic, cross-workspace facts. */
export interface WorkspaceInsight {
  type: WorkspaceInsightType
  label: string
  value: string
}

/** Phase 6 — every command here is either an existing registry command or a thin, existing-route-only wrapper (see suggestionEngine.ts). */
export interface ActionSuggestion {
  command: Command
  reason: string
}

/**
 * Phase 1/8 output. Immutable, pure data — no functions, no live
 * subscriptions. `context` is the ranked/decided source list (Phase 2);
 * references/evidence/suggestions/signals are the UX-6/UX-7 fields the
 * orchestrator composes rather than recomputes.
 */
export interface InteractionState {
  context: ContextSourceDecision[]
  references: Reference[]
  evidence: EvidenceLevel
  suggestions: string[]
  actions: ActionSuggestion[]
  attention: AttentionItem[]
  resurfacedKnowledge: ResurfacedKnowledgeItem[]
  workspace: WorkspaceInsight[]
  signals: IntelligenceSignal[]
}

export type { ContextTrace }
