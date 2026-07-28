import { providerRegistry } from '@/modules/core/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useProviderOverrideRows, useSetProviderOverride } from '@/modules/ai/providers/useProviderOverrides'
import { isProviderAvailable } from '@/modules/ai/providers/availability'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Runtime enable/disable per provider (Phase 8B.2) — replaces the old
 * static Available/Planned list with something actionable. Reads through
 * the same isProviderAvailable() every other consumer uses, so a toggle
 * here takes effect everywhere (selectors, defaults, chat, capabilities)
 * without any parallel logic.
 */
export function ProviderStatusCard() {
  const chatProviders = providerRegistry.list().filter((provider) => provider.kind === 'chat')
  const { data: availability } = useProviderAvailability()
  const { data: overrideRows = [], isLoading } = useProviderOverrideRows()
  const setOverride = useSetProviderOverride()
  const overrideByProviderId = Object.fromEntries(overrideRows.map((row) => [row.provider_id, row]))

  return (
    <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h2 className="text-sm font-medium text-[var(--color-ink)]">Provider status</h2>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Turn a provider off to stop it from being offered or used, without touching its API key.
      </p>
      {isLoading ? (
        <div className="mt-3">
          <Spinner size="sm" />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 text-sm">
          {chatProviders.map((provider) => {
            const override = overrideByProviderId[provider.id]
            const wiredUp = provider.status === 'available'
            const keyAvailable = wiredUp && isProviderAvailable(provider.id, availability)
            const enabled = override?.enabled !== false
            const statusLabel = !wiredUp
              ? 'Not wired up yet'
              : !keyAvailable
                ? 'No API key configured'
                : enabled
                  ? 'Enabled'
                  : 'Disabled'

            return (
              <li key={provider.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[var(--color-ink)]">{provider.label}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">{statusLabel}</p>
                </div>
                {wiredUp && (
                  <button
                    type="button"
                    disabled={setOverride.isPending}
                    onClick={() => setOverride.mutate({ providerId: provider.id, enabled: enabled ? false : null })}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
                      enabled
                        ? 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {enabled ? 'Disable' : 'Enable'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {setOverride.isError && (
        <p className="mt-2 text-xs text-red-600">Couldn't update provider status. Please try again.</p>
      )}
    </div>
  )
}
