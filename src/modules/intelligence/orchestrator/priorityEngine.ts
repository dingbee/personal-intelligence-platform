import type { ContextSourceKey } from '@/modules/intelligence/orchestrator/types'

export interface PriorityDefinition {
  key: ContextSourceKey
  score: number
  reason: string
}

/**
 * UX-8 Phase 2 — the fixed priority cascade from the brief: conversation
 * continuation > current workspace > recent reading > relevant memories >
 * knowledge graph > timeline > recent conversations > generic workspace.
 * This is a static order (higher score = higher priority); decisionEngine
 * is what filters it down to sources actually present this turn. Kept
 * separate from that filtering so the ordering itself stays a single,
 * reviewable source of truth instead of scattered magic numbers.
 */
const PRIORITY_ORDER: PriorityDefinition[] = [
  { key: 'continuation', score: 80, reason: 'This message continues the current conversation.' },
  { key: 'workspace', score: 70, reason: 'A specific workspace is active.' },
  { key: 'reading', score: 60, reason: 'A book or document is currently in progress.' },
  { key: 'memory', score: 50, reason: 'Stored personal context is relevant.' },
  { key: 'graph', score: 40, reason: "Related concepts exist in the user's knowledge graph." },
  { key: 'timeline', score: 30, reason: 'Recent notes or reading history are relevant.' },
  { key: 'recentConversations', score: 20, reason: 'A recent conversation touches a similar topic.' },
  { key: 'genericWorkspace', score: 10, reason: 'No more specific context is available.' },
]

export function getPriorityOrder(): PriorityDefinition[] {
  return PRIORITY_ORDER
}

export function priorityScore(key: ContextSourceKey): number {
  return PRIORITY_ORDER.find((entry) => entry.key === key)?.score ?? 0
}

export function priorityReason(key: ContextSourceKey): string {
  return PRIORITY_ORDER.find((entry) => entry.key === key)?.reason ?? ''
}
