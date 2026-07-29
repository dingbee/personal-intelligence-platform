import type { AttentionItem, AttentionPriority, AttentionType } from '@/modules/intelligence/orchestrator/types'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

const PRIORITY_WEIGHT: Record<AttentionPriority, number> = { high: 3, medium: 2, low: 1 }

/** Stable sort, highest priority first — the Attention Center's High/Medium/Low grouping (Phase 6). */
export function rankAttentionItems(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
}

/** The two graph signal types that also exist as AttentionTypes (see orchestrator/types.ts) — a disconnected concept or a whole isolated cluster is exactly the "disconnected concepts" example the brief lists under High priority. */
const GRAPH_ATTENTION_TYPES: ReadonlySet<string> = new Set(['disconnected_concept', 'knowledge_island'])

function isGraphAttentionSignal(signal: IntelligenceSignal): signal is IntelligenceSignal & { type: 'disconnected_concept' | 'knowledge_island' } {
  return GRAPH_ATTENTION_TYPES.has(signal.type)
}

export interface BuildAttentionCenterInput {
  /** Already computed by attentionEngine.detectAttentionItems (UX-8, reused unmodified) — this function never re-detects them. */
  attentionItems: AttentionItem[]
  /** Already computed by detectGraphSignals (UX-10) — reused, never recomputed. */
  graphSignals: IntelligenceSignal[]
}

/**
 * UX-11 Phase 6 — the Attention Center. Composes two existing engines
 * (UX-8's attentionEngine, UX-10's graphSignals) rather than detecting
 * anything new; the only new logic here is priority ranking.
 * "Unused documents"/"forgotten notes" from the brief's Medium-priority
 * examples are not included — no last-viewed-at tracking exists for
 * documents or notes outside reading_progress (which only covers epub
 * Reader-opened books), so there's no real data to detect them from; see
 * the phase report's Deferred items.
 */
export function buildAttentionCenter(input: BuildAttentionCenterInput): AttentionItem[] {
  const fromGraphSignals: AttentionItem[] = input.graphSignals.filter(isGraphAttentionSignal).map((signal) => ({
    type: signal.type as AttentionType,
    message: signal.message,
    priority: 'high',
  }))

  return rankAttentionItems([...input.attentionItems, ...fromGraphSignals])
}
