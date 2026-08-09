import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useProfile } from '@/modules/settings/hooks/useProfile'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { canSelectProvider } from '@/modules/plans/entitlements'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { ProfileCard } from '@/modules/settings/components/ProfileCard'
import { ChangePasswordCard } from '@/modules/settings/components/ChangePasswordCard'
import { DeleteAccountCard } from '@/modules/settings/components/DeleteAccountCard'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'

export function SettingsPage() {
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: plan } = useCurrentPlan()
  const { data: isAdmin } = usePlatformAdmin()
  const showAdvancedSettings = isAdmin || canSelectProvider(plan?.planCode)

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

      {/* Provider identity/configuration is invisible to Free/Beta entirely
          (see the Beta / Admin / AI Governance Foundation discovery doc) —
          NOVA picks a provider automatically. Pro/Enterprise (and
          founders) get a single link to a dedicated page with just the
          one provider-preference control; the richer control center
          (health/test/enable-disable) moved to the founder-only Admin
          Dashboard. */}
      {showAdvancedSettings && (
        <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--color-ink)]">Advanced Settings</h2>
            <Link to="/settings/advanced" className="text-xs text-[var(--color-accent)] hover:underline">
              Open →
            </Link>
          </div>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Choose which AI provider NOVA uses, available on your plan.</p>
        </div>
      )}

      <DeleteAccountCard />
    </div>
  )
}
