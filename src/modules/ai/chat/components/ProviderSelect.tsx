import { providerRegistry } from '@/modules/core/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { resolveAvailableProviders } from '@/modules/ai/providers/availability'

/**
 * The one provider selector in the app (pre-creation picker and the
 * in-conversation header both render this, not a copy). Options are
 * filtered to providers that are both wired up (registry status
 * 'available') and actually configured right now (availability resolver)
 * — the simplest production-safe behavior, per this task's brief:
 * unavailable providers are hidden rather than merely disabled.
 *
 * Exception: if `value` itself isn't in that filtered list — an existing
 * conversation stored with a provider that's since become unavailable —
 * it's still shown, as a single disabled "(unavailable)" option, so the
 * select reflects the conversation's true stored provider_id instead of
 * silently jumping to something else. ChatPage adds a fuller warning
 * banner alongside this for that case.
 */
export function ProviderSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const { data: availability } = useProviderAvailability()
  const allChatProviders = providerRegistry.list().filter((provider) => provider.kind === 'chat')
  const available = resolveAvailableProviders(allChatProviders, availability)

  const currentIsAvailable = available.some((provider) => provider.id === value)
  const current = allChatProviders.find((provider) => provider.id === value)

  return (
    <select
      aria-label="AI provider"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-ink-muted)] disabled:opacity-60"
    >
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
