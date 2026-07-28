import { useState } from 'react'
import type { Profile } from '@/shared/types/database'
import { useProfile } from '@/modules/settings/hooks/useProfile'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { Spinner } from '@/shared/components/ui/Spinner'

export function ProfileCard({
  email,
  userId,
  profile,
  loading,
}: {
  email: string
  userId: string
  profile: Profile | undefined
  loading: boolean
}) {
  const { updateDisplayName } = useProfile()
  const [editing, setEditing] = useState(false)

  return (
    <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h2 className="text-sm font-medium text-[var(--color-ink)]">Profile</h2>
      <dl className="mt-3 flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[var(--color-ink-muted)]">Display name</dt>
          <dd className="text-[var(--color-ink)]">
            {loading ? (
              <Spinner size="sm" />
            ) : editing ? (
              <InlineTextForm
                initialValue={profile?.display_name ?? ''}
                placeholder="Your name"
                onSubmit={(value) => {
                  updateDisplayName.mutate(value)
                  setEditing(false)
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="hover:text-[var(--color-accent)]"
              >
                {profile?.display_name || <span className="text-[var(--color-ink-muted)]">Add a name</span>}
              </button>
            )}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-ink-muted)]">Email</dt>
          <dd className="text-[var(--color-ink)]">{email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-ink-muted)]">User ID</dt>
          <dd className="text-[var(--color-ink)]">{userId}</dd>
        </div>
      </dl>
    </div>
  )
}
