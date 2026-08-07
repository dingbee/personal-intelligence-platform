import { providerRegistry } from '@/modules/core/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useProviderOverrides } from '@/modules/ai/providers/useProviderOverrides'
import { resolveAvailableProviders } from '@/modules/ai/providers/availability'

/**
 * The one provider selector in the app, currently rendered only on
 * Advanced Settings (Pro+/Founder) — the normal chat composer never
 * shows provider choice at all, for any plan. Options are filtered to
 * providers that are both wired up (registry status 'available') and
 * actually configured right now (availability resolver) — unavailable
 * providers are hidden rather than merely disabled.
 *
 * `value: null` (or `''`, normalized to null on change) means "Auto
 * (Recommended)" — no explicit preference. This isn't a hard override:
 * NOVA still selects the actual provider per-request via
 * resolveProviderChain (platform governance -> availability ->
 * preference -> health-ordered automatic fallback); this control only
 * ever expresses a preference, never pins execution directly.
 *
 * Exception: if a *non-null* `value` isn't in the filtered list — an
 * existing preference for a provider that's since become unavailable —
 * it's still shown, as a single disabled "(unavailable)" option, so the
 * select reflects the true stored preference instead of silently jumping
 * to something else.
 */
export function ProviderSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}) {
  const { data: availability } = useProviderAvailability()
  const { data: overrides } = useProviderOverrides()
  const allChatProviders = providerRegistry.list().filter((provider) => provider.kind === 'chat')
  const available = resolveAvailableProviders(allChatProviders, availability, overrides)

  const currentIsAvailable = value !== null && available.some((provider) => provider.id === value)
  const current = value !== null ? allChatProviders.find((provider) => provider.id === value) : undefined

  return (
    <select
      aria-label="AI provider"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-ink-muted)] disabled:opacity-60"
    >
      <option value="">Auto (Recommended)</option>
      {!currentIsAvailable && current && (
        <option value={current.id} disabled>
          {current.label} (unavailable)
        </option>
      )}
      {available.map((provider) => (
        <option key={provider.id} value={provider.id}>
          {provider.label}
        </option>
      ))}
    </select>
  )
}
