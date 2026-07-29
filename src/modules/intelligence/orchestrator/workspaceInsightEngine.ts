import type { WorkspaceInsight } from '@/modules/intelligence/orchestrator/types'

export interface WorkspaceStatsSummary {
  id: string
  name: string
  documentCount: number
  lastActivityAt: string | null
}

export interface WorkspaceInsightEngineInput {
  workspaces: WorkspaceStatsSummary[]
  /** Already counted by the caller (listDocuments + a 7-day cutoff) — this function does no fetching. */
  recentUploadsCount: number
  recentConversationTitles: string[]
}

const STOPWORDS = new Set([
  'about',
  'that',
  'this',
  'with',
  'from',
  'have',
  'your',
  'what',
  'which',
  'notes',
  'chat',
  'conversation',
  'untitled',
  'new',
])

/** Crude, deterministic keyword frequency — a proxy for "most queried topic" from conversation titles, not an NLP topic model. */
function mostFrequentSignificantWord(titles: string[]): string | null {
  const counts = new Map<string, number>()
  for (const title of titles) {
    for (const word of title.toLowerCase().split(/\W+/)) {
      if (word.length <= 3 || STOPWORDS.has(word)) continue
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }
  let best: string | null = null
  let bestCount = 0
  for (const [word, count] of counts) {
    if (count > bestCount) {
      best = word
      bestCount = count
    }
  }
  return bestCount > 1 ? best : null
}

/**
 * UX-8 Phase 5 — deterministic, cross-workspace facts from data the
 * caller already fetched via existing APIs (listWorkspaces +
 * getWorkspaceStats, listDocuments, listConversations). "Unread
 * documents"/"reading streak"/"most referenced document" are
 * deliberately not included — see the phase report: no existing
 * per-document read-completion or reference-count tracking to derive
 * them from without a new query/column.
 */
export function computeWorkspaceInsights(input: WorkspaceInsightEngineInput): WorkspaceInsight[] {
  const insights: WorkspaceInsight[] = []
  if (input.workspaces.length === 0) return insights

  const withActivity = input.workspaces.filter((w): w is WorkspaceStatsSummary & { lastActivityAt: string } =>
    Boolean(w.lastActivityAt),
  )
  if (withActivity.length > 0) {
    const mostActive = withActivity.reduce((a, b) => (a.lastActivityAt > b.lastActivityAt ? a : b))
    insights.push({ type: 'most_active', label: 'Most active workspace', value: mostActive.name })

    const leastActive = withActivity.reduce((a, b) => (a.lastActivityAt < b.lastActivityAt ? a : b))
    if (leastActive.id !== mostActive.id) {
      insights.push({ type: 'least_active', label: 'Least active workspace', value: leastActive.name })
    }
  }

  const largest = input.workspaces.reduce((a, b) => (b.documentCount > a.documentCount ? b : a))
  if (largest.documentCount > 0) {
    insights.push({
      type: 'largest_library',
      label: 'Largest library',
      value: `${largest.name} (${largest.documentCount} document${largest.documentCount === 1 ? '' : 's'})`,
    })
  }

  if (input.recentUploadsCount > 0) {
    insights.push({
      type: 'recent_uploads',
      label: 'Recent uploads',
      value: `${input.recentUploadsCount} in the last 7 days`,
    })
  }

  const topic = mostFrequentSignificantWord(input.recentConversationTitles)
  if (topic) {
    insights.push({ type: 'most_queried_topic', label: 'Most queried topic', value: topic })
  }

  return insights
}
