import { providerRegistry } from '@/modules/core/providers/registry'

export function ProviderSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const chatProviders = providerRegistry.list().filter((provider) => provider.kind === 'chat')

  return (
    <select
      aria-label="AI provider"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-ink-muted)]"
    >
      {chatProviders.map((provider) => (
        <option key={provider.id} value={provider.id} disabled={provider.status !== 'available'}>
          {provider.label}
        </option>
      ))}
    </select>
  )
}
