import { useV2Space } from './SpaceContext'

export function V2SpaceSwitcher() {
  const { spaces, activeSpace, setActiveSpaceId } = useV2Space()

  return (
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
            {space.kind === 'business' ? '🏢 ' : ''}{space.name} · {space.subscription}
          </option>
        ))}
      </select>
    </label>
  )
}
