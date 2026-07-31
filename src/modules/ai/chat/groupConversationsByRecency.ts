import type { Conversation } from '@/shared/types/database'

export interface ConversationGroup {
  label: string
  conversations: Conversation[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * UX-13.6 Phase 3 — buckets an already-sorted (most-recent-first, per
 * listConversations) conversation list into Today/Yesterday/This Week/
 * Last Month/Older groups by `updated_at`, the same recency signal the
 * list is already ordered by — no new query, no new column. Empty
 * buckets are omitted so the sidebar never shows a header with nothing
 * under it.
 */
export function groupConversationsByRecency(conversations: Conversation[], now: Date = new Date()): ConversationGroup[] {
  const today = startOfDay(now)
  const yesterday = today - DAY_MS
  const weekAgo = today - 7 * DAY_MS
  const monthAgo = today - 30 * DAY_MS

  const buckets: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    'Last Month': [],
    Older: [],
  }

  for (const conversation of conversations) {
    const updatedAt = new Date(conversation.updated_at).getTime()
    if (updatedAt >= today) buckets.Today!.push(conversation)
    else if (updatedAt >= yesterday) buckets.Yesterday!.push(conversation)
    else if (updatedAt >= weekAgo) buckets['This Week']!.push(conversation)
    else if (updatedAt >= monthAgo) buckets['Last Month']!.push(conversation)
    else buckets.Older!.push(conversation)
  }

  return Object.entries(buckets)
    .filter(([, group]) => group.length > 0)
    .map(([label, group]) => ({ label, conversations: group }))
}
