import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { providerRegistry } from '@/modules/core/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useAdminAiUsageSummary, useAdminPlatformProviderSettings, useAdminSetPlatformProviderSetting } from '@/modules/admin/hooks/useAdminData'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Real platform-wide provider governance — distinct from the per-account
 * "Provider status" toggle in Settings/Advanced Settings (that writes
 * provider_overrides, scoped to auth.uid()). This page writes
 * platform_provider_settings via admin_set_platform_provider_setting
 * (0036_founder_command_center.sql): `enabled: false` here removes a
 * provider from every user's resolveProviderChain eligible set, not just
 * the founder's own. A provider with no API key configured stays
 * unusable regardless of what's set here — this only ever narrows the
 * eligible set, never widens it past what's actually configured
 * server-side. No API key is ever read or displayed anywhere on this page.
 */
export function AdminAiGovernancePage() {
  const chatProviders = useMemo(() => providerRegistry.list().filter((p) => p.kind === 'chat' && p.status === 'available'), [])
  const { data: availability } = useProviderAvailability()
  const { data: settings = [], isLoading: settingsLoading } = useAdminPlatformProviderSettings()
  const { data: usage = [], isLoading: usageLoading } = useAdminAiUsageSummary()
  const setSetting = useAdminSetPlatformProviderSetting()

  const [draftPriority, setDraftPriority] = useState<Record<string, string>>({})

  const settingByProviderId = Object.fromEntries(settings.map((s) => [s.provider_id, s]))
  const usageByProviderId = Object.fromEntries(usage.map((u) => [u.provider, u]))

  function currentPriority(providerId: string): number {
    return settingByProviderId[providerId]?.priority ?? 0
  }

  function currentEnabled(providerId: string): boolean {
    return settingByProviderId[providerId]?.enabled !== false
  }

  function toggleEnabled(providerId: string) {
    setSetting.mutate({ providerId, enabled: !currentEnabled(providerId), priority: currentPriority(providerId) })
  }

  function savePriority(providerId: string) {
    const raw = draftPriority[providerId]
    const parsed = raw === undefined ? currentPriority(providerId) : Number(raw)
    if (!Number.isFinite(parsed)) return
    setSetting.mutate({ providerId, enabled: currentEnabled(providerId), priority: parsed })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">AI Governance</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Platform-wide provider control. Disabling a provider here stops it for every user, not just your own account — this is
          separate from the personal provider preference in Advanced Settings.
        </p>
      </div>

      {(settingsLoading || usageLoading) && <Spinner size="sm" />}

      <div className="flex flex-col gap-3">
        {chatProviders.map((provider) => {
          const keyAvailable = availability?.[provider.id as keyof typeof availability] ?? false
          const enabled = currentEnabled(provider.id)
          const usageRow = usageByProviderId[provider.id]

          return (
            <SurfaceCard key={provider.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-ink)]">{provider.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-muted)]">
                  <span>{keyAvailable ? '✓ API key configured' : '✕ No API key configured'}</span>
                  <span>{enabled ? '✓ Enabled platform-wide' : '✕ Disabled platform-wide'}</span>
                  <span>
                    Last 7 days: {usageRow ? `${usageRow.request_count} requests, ${usageRow.error_count} errors` : 'no traffic logged'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-[var(--color-ink-muted)]" htmlFor={`priority-${provider.id}`}>
                    Priority
                  </label>
                  <input
                    id={`priority-${provider.id}`}
                    type="number"
                    value={draftPriority[provider.id] ?? String(currentPriority(provider.id))}
                    onChange={(e) => setDraftPriority((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                    onBlur={() => savePriority(provider.id)}
                    className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                  />
                </div>
                <button
                  type="button"
                  disabled={setSetting.isPending}
                  onClick={() => toggleEnabled(provider.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
                    enabled
                      ? 'bg-[var(--surface-inset)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                      : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-strong)]'
                  }`}
                >
                  {enabled ? 'Disable platform-wide' : 'Enable platform-wide'}
                </button>
              </div>
            </SurfaceCard>
          )
        })}
      </div>

      <p className="text-xs text-[var(--color-ink-muted)]">
        Higher priority is tried first among providers that aren't a user's own preferred/default provider. Priority never overrides
        an unavailable provider (no key configured) or a per-user preference that's still eligible.
      </p>
    </div>
  )
}
