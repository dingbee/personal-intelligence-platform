export type TrendDirection = 'up' | 'down' | 'stable'

const UP_RATIO = 1.2
const DOWN_RATIO = 0.8

/**
 * UX-13 — the same "compare this week's raw count against the weekly rate
 * implied by a longer baseline window" technique dashboardMetrics.ts's
 * (private) deriveTrend already uses for the Intelligence Score, exported
 * here since knowledgeEvolution/workspaceEvolution/conceptEvolution/
 * relationshipEvolution/knowledgeForecast all need the same comparison and
 * shouldn't each reimplement it. `baselineWindowDays`/`recentWindowDays`
 * let a caller compare e.g. "last 7 days" against "last 30 days" (the
 * dashboard's convention) or any other pair of windows.
 */
export function deriveTrendDirection(
  recentCount: number,
  baselineCount: number,
  recentWindowDays: number,
  baselineWindowDays: number,
): TrendDirection {
  if (baselineCount === 0) return recentCount > 0 ? 'up' : 'stable'
  const expectedRecentRate = (baselineCount / baselineWindowDays) * recentWindowDays
  if (expectedRecentRate === 0) return recentCount > 0 ? 'up' : 'stable'
  const ratio = recentCount / expectedRecentRate
  if (ratio >= UP_RATIO) return 'up'
  if (ratio <= DOWN_RATIO) return 'down'
  return 'stable'
}

/** Whole days elapsed between `from` and `now` (never negative). Shared so every evolution module ages timestamps identically. */
export function daysSince(from: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000)))
}

export function countWithinDays(timestamps: string[], now: Date, days: number): number {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
  return timestamps.filter((t) => new Date(t).getTime() >= cutoff).length
}
