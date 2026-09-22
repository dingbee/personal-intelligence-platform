import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useProfile } from '@/modules/settings/hooks/useProfile'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { BillingCard } from '@/modules/billing/components/BillingCard'
import { ProfileCard } from '@/modules/settings/components/ProfileCard'
import { ChangePasswordCard } from '@/modules/settings/components/ChangePasswordCard'
import { DeleteAccountCard } from '@/modules/settings/components/DeleteAccountCard'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { useTheme, type ThemePreference } from '@/shared/components/theme/ThemeProvider'

export function SettingsPage() {
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  // Phase 5A — AI provider selection is an admin-only capability now, not
  // a Pro/Enterprise plan perk (see AdvancedSettingsPage's own doc
  // comment). No plan code ever grants this link anymore.
  const { data: isAdmin } = usePlatformAdmin()
  const showAdvancedSettings = isAdmin
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Manage your account.</p>
      </div>

      <ProfileCard email={user?.email ?? ''} userId={user?.id ?? ''} profile={profile} loading={profileLoading} />

      <ChangePasswordCard />

      <SurfaceCard className="max-w-md">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-ink)]">Appearance</h2>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            Choose how ARRIYIA should display. System follows your device preference automatically.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance mode">
          {([
            ['system', 'System', 'Follow device'],
            ['light', 'Light', 'Always light'],
            ['dark', 'Dark', 'Always dark'],
          ] as const).map(([value, label, description]) => {
            const selected = theme === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value as ThemePreference)}
                className={
                  'rounded-xl border px-3 py-3 text-left transition-colors ' +
                  (selected
                    ? 'border-[var(--color-accent)] bg-[var(--color-canvas)] text-[var(--color-ink)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]')
                }
              >
                <span className="block text-sm font-medium">{label}</span>
                <span className="mt-1 block text-[10px] leading-4">{description}</span>
              </button>
            )
          })}
        </div>
      </SurfaceCard>

      <BillingCard />

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
          Control what ARRIYIA remembers to personalize your experience.
        </p>
      </SurfaceCard>

      {/* Phase 5A — AI provider identity/configuration is invisible to
          every ordinary user, on every plan; ARRIYIA always picks a
          provider automatically. This link (and the preference control
          behind it) is admin-only now. */}
      {showAdvancedSettings && (
        <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--color-ink)]">Advanced Settings</h2>
            <Link to="/settings/advanced" className="text-xs text-[var(--color-accent)] hover:underline">
              Open →
            </Link>
          </div>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Admin-only AI provider preference.</p>
        </div>
      )}

      <DeleteAccountCard />
    </div>
  )
}
