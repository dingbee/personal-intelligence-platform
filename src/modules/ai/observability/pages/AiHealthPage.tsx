import { Link } from 'react-router-dom'
import { useAiHealth } from '@/modules/ai/observability/hooks/useAiHealth'
import { Spinner } from '@/shared/components/ui/Spinner'

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

function formatMs(value: number | null): string {
  return value === null ? '—' : `${value}ms`
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Read-only, over the account owner's own ai_requests history (RLS-scoped
 * already) — Provider Health, Capability Health, and Error Intelligence,
 * following the same card/table conventions as Settings' existing "Recent
 * AI activity" table rather than introducing new chrome.
 */
export function AiHealthPage() {
  const { providerHealth, capabilityHealth, errorIntelligence, windowDays, isLoading, isError } = useAiHealth()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/settings" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Back to Settings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">AI Health</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Provider and feature reliability over the last {windowDays} days, from your own request history.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">Couldn't load AI health data.</p>
      ) : (
        <>
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h2 className="text-sm font-medium text-[var(--color-ink)]">Provider health</h2>
            {providerHealth.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No chat providers registered.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[var(--color-ink-muted)]">
                      <th className="pb-2 pr-4 font-medium">Provider</th>
                      <th className="pb-2 pr-4 font-medium">Availability</th>
                      <th className="pb-2 pr-4 font-medium">Requests</th>
                      <th className="pb-2 pr-4 font-medium">Success rate</th>
                      <th className="pb-2 pr-4 font-medium">Avg / p95 latency</th>
                      <th className="pb-2 font-medium">Last failure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerHealth.map((provider) => (
                      <tr key={provider.providerId} className="border-t border-[var(--color-border)]">
                        <td className="py-2 pr-4 text-[var(--color-ink)]">{provider.label}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              provider.isAvailable
                                ? 'bg-green-100 text-green-700'
                                : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)]'
                            }`}
                          >
                            {provider.isAvailable ? 'Available' : 'Unavailable'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                          {provider.requestCount} ({provider.successCount} ok / {provider.failureCount} failed)
                        </td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatPercent(provider.successRate)}</td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                          {formatMs(provider.avgLatencyMs)} / {formatMs(provider.p95LatencyMs)}
                        </td>
                        <td className="py-2 text-[var(--color-ink-muted)]" title={provider.lastFailure?.message}>
                          {provider.lastFailure
                            ? `${provider.lastFailure.feature} — ${new Date(provider.lastFailure.at).toLocaleString()}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
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
                        <td className="py-2 text-[var(--color-ink-muted)]">{formatMs(capability.avgLatencyMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h2 className="text-sm font-medium text-[var(--color-ink)]">Error intelligence</h2>
            {errorIntelligence.groups.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No failures in this window.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {errorIntelligence.groups.map((group) => (
                    <span
                      key={group.category}
                      className="rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-xs text-[var(--color-ink-muted)]"
                    >
                      {CATEGORY_LABELS[group.category] ?? group.category}: {group.count} ({group.providers.join(', ')})
                    </span>
                  ))}
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
                          <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{failure.provider}</td>
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
