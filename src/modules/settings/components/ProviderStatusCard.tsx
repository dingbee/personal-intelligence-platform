import { Link } from 'react-router-dom'
import { useProviderIntelligence } from '@/modules/ai/providers/useProviderIntelligence'
import { HealthScoreBadge } from '@/modules/ai/observability/components/HealthScoreBadge'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * The Provider Control Center's operational surface (Phase 8B.3) — one
 * composition hook (useProviderIntelligence) feeding every row, so this
 * component itself never queries the registry/availability/overrides/health
 * systems individually. "Test" reuses the exact same ai-chat call path and
 * error normalization as a real chat message; only the ai_requests.feature
 * tag ('provider-test') distinguishes it, and that's also what keeps it out
 * of the health/usage numbers (see useAiHealth.ts).
 */
export function ProviderStatusCard() {
  const { providers, plannedProviders, setOverride, testProvider, isLoading } = useProviderIntelligence()

  return (
    <div className="max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h2 className="text-sm font-medium text-[var(--color-ink)]">Provider status</h2>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Turn a provider off to stop it from being offered or used, without touching its API key. Run a test to
        confirm its key actually works right now, not just that one is configured.
      </p>

      {isLoading ? (
        <div className="mt-3">
          <Spinner size="sm" />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {providers.map((provider) => {
            const testingThis = testProvider.isPending && testProvider.variables === provider.id
            const testResult = testProvider.data?.providerId === provider.id ? testProvider.data : undefined

            return (
              <li
                key={provider.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-ink)]">{provider.label}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-muted)]">
                      <span>{provider.enabled ? '✓ Enabled' : '✕ Disabled'}</span>
                      <span>{provider.keyAvailable ? '✓ API key configured' : '✕ No API key configured'}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <HealthScoreBadge score={provider.healthScore} isAvailable={provider.keyAvailable} />
                    <button
                      type="button"
                      disabled={setOverride.isPending}
                      onClick={() => setOverride.mutate({ providerId: provider.id, enabled: provider.enabled ? false : null })}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
                        provider.enabled
                          ? 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {provider.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                {provider.models.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-[var(--color-ink-muted)]">Models</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {provider.models.map((model) => (
                        <li
                          key={model}
                          className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]"
                        >
                          {model}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[var(--color-ink-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">Last test: </span>
                    {testResult ? (
                      testResult.success ? (
                        <span className="text-green-700">Successful just now</span>
                      ) : (
                        <span className="text-red-600">Failed just now — {testResult.message}</span>
                      )
                    ) : provider.lastTest ? (
                      provider.lastTest.success ? (
                        <span className="text-green-700">Successful {formatRelativeTime(provider.lastTest.at)}</span>
                      ) : (
                        <span className="text-red-600">
                          Failed {formatRelativeTime(provider.lastTest.at)}
                          {provider.lastTest.message ? ` — ${provider.lastTest.message}` : ''}
                        </span>
                      )
                    ) : (
                      <span>Never tested</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/settings/ai-health/provider/${provider.id}`}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      View health →
                    </Link>
                    <button
                      type="button"
                      disabled={testProvider.isPending}
                      onClick={() => testProvider.mutate(provider.id)}
                      className="shrink-0 rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-60"
                    >
                      {testingThis ? <Spinner size="sm" /> : 'Run test'}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {setOverride.isError && <p className="mt-3 text-xs text-red-600">Couldn't update provider status. Please try again.</p>}

      {plannedProviders.length > 0 && (
        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-xs font-medium text-[var(--color-ink-muted)]">Planned providers</h3>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Registered, not yet wired up — not operational.</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {plannedProviders.map((provider) => (
              <li
                key={provider.id}
                className="rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-xs text-[var(--color-ink-muted)]"
              >
                {provider.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
