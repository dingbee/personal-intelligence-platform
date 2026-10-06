import { useState } from 'react'
import { useAuth } from '@/modules/auth/useAuth'
import { createArriyiaBusinessSpace } from './enterpriseSpaces'
import { useV2Space } from './SpaceContext'

export function V2SpaceSwitcher({
  canCreateBusinessSpace = false,
  onBusinessSpaceCreated,
}: {
  canCreateBusinessSpace?: boolean
  onBusinessSpaceCreated?: () => void | Promise<void>
}) {
  const { spaces, activeSpace, setActiveSpaceId } = useV2Space()
  const { user } = useAuth()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function createBusinessSpace() {
    if (!user || !name.trim()) return

    setCreating(true)
    setError(null)
    try {
      const created = await createArriyiaBusinessSpace(user.id, name)
      await onBusinessSpaceCreated?.()
      setName('')
      setCreating(false)
      setActiveSpaceId(created.id)
    } catch (creationError) {
      setCreating(false)
      setError(
        creationError instanceof Error
          ? creationError.message
          : 'Unable to create the Business Space.',
      )
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="flex min-w-0 items-center gap-2">
        <span className="sr-only">Active ARRIYIA space</span>
        <select
          aria-label="Active ARRIYIA space"
          value={activeSpace?.spaceId ?? ''}
          onChange={(event) => setActiveSpaceId(event.target.value)}
          className="min-w-0 max-w-[16rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--border-subtle)]"
        >
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.kind === 'business' ? 'Business · ' : ''}{space.name}
            </option>
          ))}
        </select>
      </label>

      {canCreateBusinessSpace && (
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">
            + Business
          </summary>
          <div className="absolute right-0 top-12 z-30 w-80 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-xl">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Create Business Space</div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Enterprise entitlement is checked again by the database before creation.
            </p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void createBusinessSpace()
              }}
              placeholder="Business name"
              aria-label="Business Space name"
              disabled={creating}
              className="mt-3 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm outline-none"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <button
              type="button"
              disabled={creating || !name.trim()}
              onClick={() => void createBusinessSpace()}
              className="mt-3 w-full rounded-xl bg-[var(--text-primary)] px-3 py-2 text-sm font-medium text-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create Business Space'}
            </button>
          </div>
        </details>
      )}
    </div>
  )
}
