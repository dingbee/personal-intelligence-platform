import type { Conversation } from '@/shared/types/database'

export interface ConversationGroup {
  label: string
  conversations: Conversation[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const PINNED_LABEL = '📌 Pinned'

/**
 * UX-13.6 Phase 3 — buckets an already-sorted (pinned-first, then most-
 * recent, per listConversations) conversation list into Pinned/Today/
 * Yesterday/This Week/Last Month/Older groups. Pinned conversations are
 * pulled out first and never appear in a date bucket too — "pin floats
 * to the top independent of recency" means exactly one group, not two.
 * Everything else buckets by `updated_at`, the same recency signal the
 * list is already ordered by — no new query beyond is_pinned itself.
 * Empty buckets are omitted so the sidebar never shows a header with
 * nothing under it.
 */
export function groupConversationsByRecency(conversations: Conversation[], now: Date = new Date()): ConversationGroup[] {
  const today = startOfDay(now)
  const yesterday = today - DAY_MS
  const weekAgo = today - 7 * DAY_MS
  const monthAgo = today - 30 * DAY_MS

  const buckets: Record<string, Conversation[]> = {
    [PINNED_LABEL]: [],
    Today: [],
    Yesterday: [],
    'This Week': [],
    'Last Month': [],
    Older: [],
  }

  for (const conversation of conversations) {
    if (conversation.is_pinned) {
      buckets[PINNED_LABEL]!.push(conversation)
      continue
    }
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
