import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAiHealth } from '@/modules/ai/observability/hooks/useAiHealth'
import { computeErrorIntelligence } from '@/modules/ai/observability/aiHealthAggregation'
import { HealthScoreBadge } from '@/modules/ai/observability/components/HealthScoreBadge'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'

const CATEGORY_LABELS: Record<string, string> = {
  provider_unavailable: 'Provider unavailable',
  rate_limited: 'Rate limited',
  timeout: 'Timeout',
  invalid_response: 'Invalid response',
  unknown: 'Unknown',
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

/**
 * Drill-down for one provider — reuses useAiHealth (same cache key as
 * AiHealthPage when the window matches, so navigating here rarely costs
 * a second fetch) and computeErrorIntelligence directly on a provider-
 * filtered slice of requests, rather than a second error-grouping
 * implementation.
 */
export function ProviderHealthDetailPage() {
  const { providerId } = useParams<{ providerId: string }>()
  const { providerHealth, requests, isLoading, isError } = useAiHealth('7d')

  const provider = providerHealth.find((entry) => entry.providerId === providerId)
  const providerRequests = useMemo(
    () => requests.filter((request) => request.provider === providerId),
    [requests, providerId],
  )
  const errorIntelligence = useMemo(() => computeErrorIntelligence(providerRequests), [providerRequests])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (isError || !provider) {
    return (
      <EmptyState
        title="Provider not found"
        description="It may not be a registered chat provider."
        action={
          <Link to="/settings/ai-health">
            <Button variant="secondary">Back to AI Health</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/settings/ai-health" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            ← Back to AI Health
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{provider.label}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Last 7 days.</p>
        </div>
        <Link to="/settings" className="text-xs text-[var(--color-accent)] hover:underline">
          Manage in Settings →
        </Link>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Overview</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Availability</dt>
            <dd className="mt-0.5 text-[var(--color-ink)]">{provider.isAvailable ? 'Available' : 'Unavailable'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Health score</dt>
            <dd className="mt-0.5">
              <HealthScoreBadge score={provider.healthScore} isAvailable={provider.isAvailable} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Requests</dt>
            <dd className="mt-0.5 text-[var(--color-ink)]">{provider.requestCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Last failure</dt>
            <dd className="mt-0.5 text-[var(--color-ink)]">
              {provider.lastFailure ? new Date(provider.lastFailure.at).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Performance</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Success rate</dt>
            <dd className="mt-0.5 text-[var(--color-ink)]">{formatPercent(provider.successRate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Failures</dt>
            <dd className="mt-0.5 text-[var(--color-ink)]">{provider.failureCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">Avg latency</dt>
            <dd className="mt-0.5 text-[var(--color-ink)]">{formatLatency(provider.avgLatencyMs)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-ink-muted)]">p95 latency</dt>
            <dd className="mt-0.5 text-[var(--color-ink)]">{formatLatency(provider.p95LatencyMs)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Errors by category</h2>
        {errorIntelligence.groups.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No failures in this window.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {errorIntelligence.groups.map((group) => (
              <li
                key={group.category}
                className="rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-xs text-[var(--color-ink-muted)]"
              >
                {CATEGORY_LABELS[group.category] ?? group.category}: {group.count}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Recent activity</h2>
        {providerRequests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No requests in this window.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">When</th>
                  <th className="pb-2 pr-4 font-medium">Feature</th>
                  <th className="pb-2 pr-4 font-medium">Latency</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {providerRequests.slice(0, 50).map((request) => (
                  <tr key={request.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {new Date(request.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink)]">{request.feature}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatLatency(request.latency_ms)}</td>
                    <td className="py-2">
                      <span
                        className={request.status === 'success' ? 'text-green-700' : 'text-red-600'}
                        title={request.error_message ?? undefined}
                      >
                        {request.status}
                      </span>
                      {request.fallback_reason && (
                        <span
                          className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                          title={request.fallback_reason}
                        >
                          fallback
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
