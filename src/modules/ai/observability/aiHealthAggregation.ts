import type { AiRequest } from '@/shared/types/database'
import type { AIProviderDescriptor } from '@/modules/core/providers/types'
import { normalizeAiError, type AiErrorCategory } from '@/modules/ai/orchestration/normalizeAiError'

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]!
}

export interface ProviderHealthStats {
  providerId: string
  label: string
  requestCount: number
  successCount: number
  failureCount: number
  /** null when there's no data in the window — distinct from a real 0% rate. */
  successRate: number | null
  avgLatencyMs: number | null
  p95LatencyMs: number | null
  lastFailure: { at: string; feature: string; message: string } | null
}

/**
 * One row per chat provider the registry knows about — including ones
 * with zero requests in the window, so a provider nobody's tried yet
 * still shows up (with its live availability, merged in by the caller)
 * rather than silently disappearing from the table.
 *
 * Assumes `requests` is already ordered newest-first (as
 * listAiRequestsSince returns it) — lastFailure relies on that ordering
 * rather than re-sorting.
 */
export function computeProviderHealth(
  requests: AiRequest[],
  chatProviders: AIProviderDescriptor[],
): ProviderHealthStats[] {
  return chatProviders.map((provider) => {
    const forProvider = requests.filter((request) => request.provider === provider.id)
    const successes = forProvider.filter((request) => request.status === 'success')
    const failures = forProvider.filter((request) => request.status === 'error')
    const lastFailure = failures[0]

    return {
      providerId: provider.id,
      label: provider.label,
      requestCount: forProvider.length,
      successCount: successes.length,
      failureCount: failures.length,
      successRate: forProvider.length > 0 ? successes.length / forProvider.length : null,
      avgLatencyMs: average(forProvider.map((request) => request.latency_ms)),
      p95LatencyMs: percentile(forProvider.map((request) => request.latency_ms), 95),
      lastFailure: lastFailure
        ? { at: lastFailure.created_at, feature: lastFailure.feature, message: lastFailure.error_message ?? 'Unknown error' }
        : null,
    }
  })
}

export interface CapabilityHealthStats {
  feature: string
  requestCount: number
  successRate: number | null
  avgLatencyMs: number | null
}

/**
 * Grouped by whatever distinct `feature` values are actually present —
 * this includes embedding-pipeline features (retrieval/indexing/
 * processing) alongside runCapability capability ids (summarize,
 * flashcards, ...), since ai_requests.feature doesn't distinguish them
 * and "usage by AI feature" is meant generically. Sorted by volume, not
 * alphabetically, so the busiest features surface first.
 */
export function computeCapabilityHealth(requests: AiRequest[]): CapabilityHealthStats[] {
  const byFeature = new Map<string, AiRequest[]>()
  for (const request of requests) {
    const rows = byFeature.get(request.feature) ?? []
    rows.push(request)
    byFeature.set(request.feature, rows)
  }

  return Array.from(byFeature.entries())
    .map(([feature, rows]) => ({
      feature,
      requestCount: rows.length,
      successRate: rows.filter((request) => request.status === 'success').length / rows.length,
      avgLatencyMs: average(rows.map((request) => request.latency_ms)),
    }))
    .sort((a, b) => b.requestCount - a.requestCount)
}

export interface ErrorCategoryGroup {
  category: AiErrorCategory
  count: number
  providers: string[]
}

export interface RecentAiFailure {
  id: string
  createdAt: string
  feature: string
  provider: string
  category: AiErrorCategory
  /** Raw error text — shown here deliberately: this is a diagnostic surface over the account owner's own request history, the same posture Settings' existing error tooltip already takes. */
  message: string
}

export interface ErrorIntelligence {
  groups: ErrorCategoryGroup[]
  recentFailures: RecentAiFailure[]
}

const RECENT_FAILURES_LIMIT = 10

/**
 * Categorizes each stored failure by re-running it through
 * normalizeAiError (Phase 7D) — reusing the exact same category logic
 * used to sanitize live errors, rather than duplicating it. error_message
 * is a plain string in the database, not a thrown Error, so it's re-
 * wrapped (`new Error(...)`) to match normalizeAiError's signature; this
 * doesn't change what it does, since it only ever reads `.message`.
 *
 * Assumes `requests` is already ordered newest-first.
 */
export function computeErrorIntelligence(requests: AiRequest[]): ErrorIntelligence {
  const failures = requests.filter((request) => request.status === 'error')
  const byCategory = new Map<AiErrorCategory, { count: number; providers: Set<string> }>()
  const recentFailures: RecentAiFailure[] = []

  for (const failure of failures) {
    const message = failure.error_message ?? 'Unknown error'
    const category = normalizeAiError(new Error(message)).category

    const bucket = byCategory.get(category) ?? { count: 0, providers: new Set<string>() }
    bucket.count += 1
    bucket.providers.add(failure.provider)
    byCategory.set(category, bucket)

    if (recentFailures.length < RECENT_FAILURES_LIMIT) {
      recentFailures.push({
        id: failure.id,
        createdAt: failure.created_at,
        feature: failure.feature,
        provider: failure.provider,
        category,
        message,
      })
    }
  }

  const groups = Array.from(byCategory.entries())
    .map(([category, { count, providers }]) => ({ category, count, providers: Array.from(providers) }))
    .sort((a, b) => b.count - a.count)

  return { groups, recentFailures }
}
