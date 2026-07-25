import { useAuth } from '@/modules/auth/useAuth'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { providerRegistry } from '@/modules/core/providers/registry'
import { useRecentAiRequests } from '@/modules/ai/observability/hooks/useRecentAiRequests'

export function SettingsPage() {
  const { user } = useAuth()
  const capabilities = capabilityRegistry.list()
  const providers = providerRegistry.list()
  const { data: aiRequests = [] } = useRecentAiRequests()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Manage your account.</p>
      </div>
      <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--color-ink-muted)]">Email</dt>
            <dd className="text-[var(--color-ink)]">{user?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-ink-muted)]">User ID</dt>
            <dd className="text-[var(--color-ink)]">{user?.id}</dd>
          </div>
        </dl>
      </div>

      <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">AI capabilities</h2>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Registered by platform modules. "Chat" is wired to a real provider; the rest are metadata only until a
          later milestone implements them.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {capabilities.map((capability) => (
            <li
              key={capability.id}
              title={capability.description}
              className="rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-xs text-[var(--color-ink-muted)]"
            >
              {capability.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">AI providers</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {providers.map((provider) => (
            <li key={provider.id} className="flex items-center justify-between">
              <span className="text-[var(--color-ink)]">{provider.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  provider.status === 'available'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)]'
                }`}
              >
                {provider.status === 'available' ? 'Available' : 'Planned'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Recent AI activity</h2>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Every chat and embedding call, logged for debugging, usage, and future cost tracking.
        </p>
        {aiRequests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No AI requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">Feature</th>
                  <th className="pb-2 pr-4 font-medium">Provider / model</th>
                  <th className="pb-2 pr-4 font-medium">Tokens (in/out)</th>
                  <th className="pb-2 pr-4 font-medium">Latency</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {aiRequests.map((request) => (
                  <tr key={request.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2 pr-4 text-[var(--color-ink)]">{request.feature}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {request.provider}
                      {request.model ? ` / ${request.model}` : ''}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {request.tokens_input ?? '–'} / {request.tokens_output ?? '–'}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{request.latency_ms}ms</td>
                    <td className="py-2">
                      <span
                        className={
                          request.status === 'success'
                            ? 'text-green-700'
                            : 'text-red-600'
                        }
                        title={request.error_message ?? undefined}
                      >
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
