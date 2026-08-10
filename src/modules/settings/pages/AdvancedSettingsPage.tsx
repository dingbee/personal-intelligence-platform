import { Link, Navigate } from 'react-router-dom'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { useProfile } from '@/modules/settings/hooks/useProfile'
import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'
import { Spinner } from '@/shared/components/ui/Spinner'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'

/**
 * Phase 5A — ARRIYIA users must never know which AI provider/model they're
 * using; AI provider governance is an admin-only capability. This page
 * (the one place a provider can be seen or chosen at all — never the main
 * chat composer, see ChatPage/ReaderChatPanel, which are provider-neutral
 * for every plan) is now reachable by platform admins only, regardless of
 * plan. Ordinary users, including Pro/Founding Pro, are redirected out
 * before rendering anything provider-shaped.
 *
 * AI Preference Layer v1 — renders the user's raw, un-resolved
 * `default_chat_provider_id` (null included) rather than a pre-resolved
 * fallback, so "Auto (Recommended)" actually shows as selected when
 * there's no preference. This control expresses a preference only; NOVA
 * still decides execution per-request via resolveProviderChain, itself
 * now also filtered by the caller's plan (see usePlanAllowedProviders).
 */
export function AdvancedSettingsPage() {
  const { data: plan } = useCurrentPlan()
  const { data: isAdmin, isLoading: adminLoading } = usePlatformAdmin()
  const { data: profile, isLoading: profileLoading, updateDefaultProvider } = useProfile()

  if (adminLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/settings" replace />
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/settings" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Advanced Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Admin-only. Your plan: {plan?.planName ?? 'Founder'}.</p>
      </div>

      <SurfaceCard className="max-w-md">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">AI Provider</h2>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Auto (Recommended) lets ARRIYIA pick the best available provider for every request. Choosing a provider only
          sets a preference — ARRIYIA still applies platform availability and health before using it. Used for new
          conversations and AI features unless a conversation already has its own provider set.
        </p>
        <div className="mt-3 flex items-center gap-2">
          {profileLoading ? (
            <Spinner size="sm" />
          ) : (
            <ProviderSelect
              value={profile?.default_chat_provider_id ?? null}
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
