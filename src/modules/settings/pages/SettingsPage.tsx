import { useAuth } from '@/modules/auth/useAuth'

export function SettingsPage() {
  const { user } = useAuth()

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
    </div>
  )
}
