import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAiHealth, TIME_RANGE_OPTIONS, type TimeRange } from '@/modules/ai/observability/hooks/useAiHealth'
import { providerRegistry } from '@/modules/core/providers/registry'
import { MetricCard, type MetricTrend } from '@/modules/ai/observability/components/MetricCard'
import { ProviderHealthCard } from '@/modules/ai/observability/components/ProviderHealthCard'
import { ErrorDistributionChart } from '@/modules/ai/observability/components/ErrorDistributionChart'
import { Spinner } from '@/shared/components/ui/Spinner'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

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

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

type TrendKind = 'higherIsBetter' | 'lowerIsBetter' | 'neutral'

function toMetricTrend(percent: number | null, kind: TrendKind, suffix = '%'): MetricTrend | undefined {
  if (percent === null) return undefined
  const direction = percent === 0 ? 'flat' : percent > 0 ? 'up' : 'down'
  const isGood = kind === 'neutral' || percent === 0 ? null : kind === 'higherIsBetter' ? percent > 0 : percent < 0
  return { direction, text: `${Math.abs(percent)}${suffix}`, isGood }
}

/** Inline "↑ 3%" style delta, colored by whether the direction is good/bad/neutral for this metric. */
function TrendDelta({ percent, kind }: { percent: number | null; kind: TrendKind }) {
  const trend = toMetricTrend(percent, kind)
  if (!trend) return null
  const arrow = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'
  const colorClass = trend.isGood === false ? 'text-[var(--color-danger)]' : trend.isGood ? 'text-[var(--color-success)]' : 'text-[var(--color-ink-muted)]'
  return (
    <span className={colorClass}>
      {arrow} {trend.text}
    </span>
  )
}

/**
 * Read-only, over the account owner's own ai_requests history (RLS-scoped
 * already). Section order: usage overview -> provider health (clickable,
 * scored) -> performance trends -> capability health -> error
 * intelligence. Card chrome uses the new shadow-soft token for a soft-
 * raised, tactile feel — this phase's step toward the eventual
 * neomorphic direction, applied only here, not retrofitted onto the rest
 * of Settings.
 */
export function AiHealthPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const {
    providerHealth,
    capabilityHealth,
    errorIntelligence,
    usageOverview,
    lastSuccess,
    overallTrend,
    providerTrends,
    isLoading,
    isError,
  } = useAiHealth(timeRange)

  const rangeLabel = TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.label ?? ''

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/settings" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            ← Back to Settings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">AI Health</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Provider and feature reliability, from your own request history.
          </p>
        </div>
        <div className="flex gap-1.5">
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTimeRange(option.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                timeRange === option.value
                  ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]'
                  : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-[var(--color-danger)]">Couldn't load AI health data.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="AI requests" value={String(usageOverview.totalRequests)} sublabel={rangeLabel} />
            <MetricCard
              label="Success rate"
              value={formatPercent(usageOverview.successRate)}
              trend={toMetricTrend(overallTrend.successRateChangePoints, 'higherIsBetter')}
            />
            <MetricCard
              label="Latency"
              value={formatLatency(usageOverview.avgLatencyMs)}
              sublabel="Average"
              trend={toMetricTrend(overallTrend.avgLatencyChangePercent, 'lowerIsBetter')}
            />
            <MetricCard
              label="Providers"
              value={`${usageOverview.availableProviderCount} / ${usageOverview.totalProviderCount}`}
              sublabel="Available"
            />
          </div>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft">
            <h2 className="text-sm font-medium text-[var(--color-ink)]">Provider health</h2>
            {providerHealth.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No chat providers registered.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {providerHealth.map((provider) => (
                  <ProviderHealthCard
                    key={provider.providerId}
                    providerId={provider.providerId}
                    label={provider.label}
                    healthScore={provider.healthScore}
                    isAvailable={provider.isAvailable}
                    requestCount={provider.requestCount}
                    successRate={provider.successRate}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft">
            <h2 className="text-sm font-medium text-[var(--color-ink)]">Performance trends</h2>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Last 24 hours vs. the previous 24 hours.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providerHealth.map((provider) => {
                const trend = providerTrends.get(provider.providerId)
                if (!trend) return null
                return (
                  <div key={provider.providerId} className="rounded-lg bg-[var(--color-canvas)] p-4">
                    <p className="text-sm font-medium text-[var(--color-ink)]">{provider.label}</p>
                    <dl className="mt-2 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--color-ink-muted)]">Requests</dt>
                        <dd className="flex items-center gap-1">
                          <span className="text-[var(--color-ink)]">{trend.current.requestCount}</span>
                          <TrendDelta percent={trend.requestCountChangePercent} kind="neutral" />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--color-ink-muted)]">Success rate</dt>
                        <dd className="flex items-center gap-1">
                          <span className="text-[var(--color-ink)]">{formatPercent(trend.current.successRate)}</span>
                          <TrendDelta percent={trend.successRateChangePoints} kind="higherIsBetter" />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-[var(--color-ink-muted)]">Latency</dt>
                        <dd className="flex items-center gap-1">
                          <span className="text-[var(--color-ink)]">{formatLatency(trend.current.avgLatencyMs)}</span>
                          <TrendDelta percent={trend.avgLatencyChangePercent} kind="lowerIsBetter" />
                        </dd>
                      </div>
                    </dl>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft">
            <h2 className="text-sm font-medium text-[var(--color-ink)]">Capability health</h2>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Usage by AI feature, including embedding/indexing/retrieval alongside capabilities like Summarize.
            </p>
            {capabilityHealth.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No AI activity in this window yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[var(--color-ink-muted)]">
                      <th className="pb-2 pr-4 font-medium">Feature</th>
                      <th className="pb-2 pr-4 font-medium">Requests</th>
                      <th className="pb-2 pr-4 font-medium">Success rate</th>
                      <th className="pb-2 font-medium">Avg latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capabilityHealth.map((capability) => (
                      <tr key={capability.feature} className="border-t border-[var(--color-border)]">
                        <td className="py-2 pr-4 text-[var(--color-ink)]">{capability.feature}</td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{capability.requestCount}</td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatPercent(capability.successRate)}</td>
                        <td className="py-2 text-[var(--color-ink-muted)]">{formatLatency(capability.avgLatencyMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-soft">
            <h2 className="text-sm font-medium text-[var(--color-ink)]">Error intelligence</h2>

            {(errorIntelligence.groups.length > 0 || lastSuccess) && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {errorIntelligence.groups.length > 0 && (
                  <div className="rounded-lg bg-[var(--color-canvas)] p-3">
                    <p className="text-xs font-medium text-[var(--color-ink-muted)]">Most common issue</p>
                    <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                      {CATEGORY_LABELS[errorIntelligence.groups[0]!.category] ?? errorIntelligence.groups[0]!.category}
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {errorIntelligence.groups[0]!.count} occurrence{errorIntelligence.groups[0]!.count === 1 ? '' : 's'}
                    </p>
                  </div>
                )}
                {lastSuccess && (
                  <div className="rounded-lg bg-[var(--color-canvas)] p-3">
                    <p className="text-xs font-medium text-[var(--color-ink-muted)]">Last successful AI call</p>
                    <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                      {providerRegistry.get(lastSuccess.provider)?.label ?? lastSuccess.provider} · {lastSuccess.feature}
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">{formatRelativeTime(lastSuccess.at)}</p>
                  </div>
                )}
              </div>
            )}

            {errorIntelligence.groups.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--color-ink-muted)]">No failures in this window.</p>
            ) : (
              <>
                <div className="mt-4">
                  <p className="text-xs font-medium text-[var(--color-ink-muted)]">Provider errors</p>
                  <div className="mt-2">
                    <ErrorDistributionChart groups={errorIntelligence.groups} />
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[var(--color-ink-muted)]">
                        <th className="pb-2 pr-4 font-medium">When</th>
                        <th className="pb-2 pr-4 font-medium">Feature</th>
                        <th className="pb-2 pr-4 font-medium">Provider</th>
                        <th className="pb-2 pr-4 font-medium">Category</th>
                        <th className="pb-2 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorIntelligence.recentFailures.map((failure) => (
                        <tr key={failure.id} className="border-t border-[var(--color-border)]">
                          <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                            {new Date(failure.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 pr-4 text-[var(--color-ink)]">{failure.feature}</td>
                          <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                            {failure.provider}
                            {failure.fallbackReason && (
                              <span
                                className="ml-1.5 rounded-full bg-[var(--color-warning-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-warning-strong)]"
                                title={failure.fallbackReason}
                              >
                                fallback
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                            {CATEGORY_LABELS[failure.category] ?? failure.category}
                          </td>
                          <td className="py-2 text-[var(--color-ink-muted)]" title={failure.message}>
                            {truncate(failure.message)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
