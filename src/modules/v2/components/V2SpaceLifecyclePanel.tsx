import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useV2Space } from '../workspace/SpaceContext'
import {
  archiveArriyiaBusinessSpace,
  pauseArriyiaBusinessSpace,
  resumeArriyiaBusinessSpace,
} from '../workspace/enterpriseSpaces'

export function V2SpaceLifecyclePanel() {
  const { activeSpace } = useV2Space()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!activeSpace || activeSpace.kind !== 'business' || activeSpace.membershipRole !== 'owner') {
    return null
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: ['arriyia-v2-spaces'] })
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Space lifecycle action failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Active Business Space
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{activeSpace.spaceId}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            This Space is persistent, Enterprise-entitled and membership-backed. Its organization namespace
            is passed to NoVA Core when V2 execution integration is wired.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">
              Status: {activeSpace.kind === 'business' ? 'Business' : 'Personal'}
            </span>
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">
              Tier: {activeSpace.subscription}
            </span>
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">
              Role: {activeSpace.membershipRole}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeSpace.status === 'active' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => pauseArriyiaBusinessSpace(activeSpace.spaceId))}
                className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Pause
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => archiveArriyiaBusinessSpace(activeSpace.spaceId))}
                className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Archive
              </button>
            </>
          )}
          {activeSpace.status === 'paused' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => resumeArriyiaBusinessSpace(activeSpace.spaceId))}
              className="rounded-xl bg-[var(--text-primary)] px-3 py-2 text-sm font-medium text-[var(--surface-raised)] disabled:opacity-50"
            >
              Resume
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </section>
  )
}
