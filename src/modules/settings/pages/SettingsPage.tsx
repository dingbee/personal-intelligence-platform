import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useRecentAiRequests } from '@/modules/ai/observability/hooks/useRecentAiRequests'
import { useProfile } from '@/modules/settings/hooks/useProfile'
import { ProfileCard } from '@/modules/settings/components/ProfileCard'
import { ChangePasswordCard } from '@/modules/settings/components/ChangePasswordCard'
import { ProviderStatusCard } from '@/modules/settings/components/ProviderStatusCard'
import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { Spinner } from '@/shared/components/ui/Spinner'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'

export function SettingsPage() {
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading, updateDefaultProvider } = useProfile()
  const defaultProviderId = useDefaultChatProviderId()
  const { data: aiRequests = [] } = useRecentAiRequests()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Manage your account.</p>
      </div>

      <ProfileCard email={user?.email ?? ''} userId={user?.id ?? ''} profile={profile} loading={profileLoading} />

      <ChangePasswordCard />

      <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--color-ink)]">Workspaces</h2>
          <Link to="/settings/workspaces" className="text-xs text-[var(--color-accent)] hover:underline">
            Manage workspaces →
          </Link>
        </div>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Rename, reorder, archive, or delete your workspaces, and see what's in each one.
        </p>
      </div>

      <SurfaceCard className="max-w-md">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--color-ink)]">Memory & Personalization</h2>
          <Link to="/settings/memory" className="text-xs text-[var(--color-accent)] hover:underline">
            Manage memories →
          </Link>
        </div>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Control what NOVA remembers to personalize your experience.
        </p>
      </SurfaceCard>

      <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Default AI provider</h2>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Used for new conversations and AI features (summaries, flashcards, knowledge extraction) unless a
          conversation already has its own provider set.
        </p>
        <div className="mt-3 flex items-center gap-2">
          {profileLoading ? (
            <Spinner size="sm" />
          ) : (
            <ProviderSelect
              value={defaultProviderId}
              onChange={(id) => updateDefaultProvider.mutate(id)}
              disabled={updateDefaultProvider.isPending}
            />
          )}
          {updateDefaultProvider.isPending && <Spinner size="sm" />}
        </div>
        {updateDefaultProvider.isError && (
          <p className="mt-2 text-xs text-red-600">Couldn't save your default provider. Please try again.</p>
        )}
      </div>

      <ProviderStatusCard />

      <div className="max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--color-ink)]">Recent AI activity</h2>
          <Link to="/settings/ai-health" className="text-xs text-[var(--color-accent)] hover:underline">
            View AI health →
          </Link>
        </div>
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
