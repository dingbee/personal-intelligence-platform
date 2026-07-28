export type HealthStatus = 'excellent' | 'healthy' | 'degraded' | 'critical'

export interface ProviderHealthScoreInput {
  isAvailable: boolean
  requestCount: number
  /** 0-1 fraction, null when requestCount is 0. */
  successRate: number | null
  avgLatencyMs: number | null
  /** Most recent failed request, if any, in the aggregation window. */
  lastFailure: { at: string } | null
}

/**
 * 100-90 Excellent, 89-70 Healthy, 69-40 Degraded, 39-0 Critical — a pure
 * mapping with no provider-specific behavior. "Offline" (shown for an
 * unavailable provider) is a UI-layer label, not a fifth tier here: an
 * unavailable provider scores 0 via calculateProviderHealthScore and would
 * map to 'critical' through this same function, same as any other
 * provider that scores 0 for other reasons.
 */
export function getHealthStatus(score: number): HealthStatus {
  if (score >= 90) return 'excellent'
  if (score >= 70) return 'healthy'
  if (score >= 40) return 'degraded'
  return 'critical'
}

// Generic latency curve — not tuned to any specific provider's typical
// response time, just "fast" vs "slow" for an LLM call in general.
// Comfortable up to 2s, degrades linearly, floors out by 12s.
const LATENCY_COMFORTABLE_MS = 2000
const LATENCY_FLOOR_MS = 12000

function scoreLatency(avgLatencyMs: number | null): number {
  if (avgLatencyMs === null) return 100
  if (avgLatencyMs <= LATENCY_COMFORTABLE_MS) return 100
  if (avgLatencyMs >= LATENCY_FLOOR_MS) return 0
  const range = LATENCY_FLOOR_MS - LATENCY_COMFORTABLE_MS
  return Math.round(100 * (1 - (avgLatencyMs - LATENCY_COMFORTABLE_MS) / range))
}

// Recency-weighted penalty for the most recent failure — a provider that
// just failed scores lower right now than one whose only failure was a
// week ago, even if their success rate over the whole window is identical.
function scoreRecency(lastFailure: { at: string } | null, nowMs: number): number {
  if (!lastFailure) return 100
  const hoursSince = (nowMs - new Date(lastFailure.at).getTime()) / (1000 * 60 * 60)
  if (hoursSince < 1) return 0
  if (hoursSince < 6) return 40
  if (hoursSince < 24) return 70
  if (hoursSince < 24 * 7) return 90
  return 100
}

const WEIGHTS = { successRate: 0.5, latency: 0.3, recency: 0.2 }

/**
 * Combines availability, success rate, latency, and how recently the
 * provider last failed into a single 0-100 score. Nothing here is keyed
 * by provider id or label — every input is a generic metric any current
 * or future chat provider produces, so a brand-new provider works with
 * this function on day one.
 *
 * "Error frequency" is captured through successRate (its complement)
 * rather than as a separate term — the two aren't independent signals.
 *
 * - Unavailable providers always score 0 (shown as "Offline" in the UI).
 * - Available providers with no request history yet score 100 (nothing
 *   bad has happened; not the same as a provider with a bad track record).
 */
export function calculateProviderHealthScore(input: ProviderHealthScoreInput, nowMs: number = Date.now()): number {
  if (!input.isAvailable) return 0
  if (input.requestCount === 0) return 100

  const successRateScore = (input.successRate ?? 1) * 100
  const latencyScore = scoreLatency(input.avgLatencyMs)
  const recencyScore = scoreRecency(input.lastFailure, nowMs)

  const weighted =
    successRateScore * WEIGHTS.successRate + latencyScore * WEIGHTS.latency + recencyScore * WEIGHTS.recency

  return Math.max(0, Math.min(100, Math.round(weighted)))
}
