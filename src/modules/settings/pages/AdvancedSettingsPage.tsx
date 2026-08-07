import { Link, Navigate } from 'react-router-dom'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { canSelectProvider } from '@/modules/plans/entitlements'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { useProfile } from '@/modules/settings/hooks/useProfile'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'
import { Spinner } from '@/shared/components/ui/Spinner'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'

/**
 * The one place a Pro/Enterprise (or founder) user can see or choose an
 * AI provider — never the main chat composer (see ChatPage/
 * ReaderChatPanel, which are provider-neutral for every plan). Free/Beta
 * never reach this page at all: redirected out before rendering anything
 * provider-shaped, same as the entitlement check ChatPage never needed
 * to make since it no longer renders provider UI regardless of plan.
 */
export function AdvancedSettingsPage() {
  const { data: plan, isLoading: planLoading } = useCurrentPlan()
  const { data: isAdmin, isLoading: adminLoading } = usePlatformAdmin()
  const { data: profile, isLoading: profileLoading, updateDefaultProvider } = useProfile()
  const defaultProviderId = useDefaultChatProviderId()

  if (planLoading || adminLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!isAdmin && !canSelectProvider(plan?.planCode)) {
    return <Navigate to="/settings" replace />
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/settings" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Advanced Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Available on your plan — {plan?.planName ?? 'Founder'}.</p>
      </div>

      <SurfaceCard className="max-w-md">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">AI Provider</h2>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Used for new conversations and AI features unless a conversation already has its own provider set. Only
          providers that are currently configured and available are shown.
        </p>
        <div className="mt-3 flex items-center gap-2">
          {profileLoading ? (
            <Spinner size="sm" />
          ) : (
            <ProviderSelect
              value={profile?.default_chat_provider_id ?? defaultProviderId}
              onChange={(id) => updateDefaultProvider.mutate(id)}
              disabled={updateDefaultProvider.isPending}
            />
          )}
          {updateDefaultProvider.isPending && <Spinner size="sm" />}
        </div>
        {updateDefaultProvider.isError && (
          <p className="mt-2 text-xs text-[var(--color-danger)]">Couldn't save your provider preference. Please try again.</p>
        )}
      </SurfaceCard>
    </div>
  )
}
