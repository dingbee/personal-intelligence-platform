import { Link } from 'react-router-dom'
import { useGreeting } from '@/modules/greeting/hooks/useGreeting'
import { WorkspacePresence } from '@/modules/workspaces/components/WorkspacePresence'
import { ProfileMenu } from '@/shared/components/layout/ProfileMenu'
import { PlanIdentityBadge } from '@/modules/plans/components/PlanIdentityBadge'

/**
 * The personal header (Phase UX-3) — replaces the old email + Sign out row
 * with a contextual greeting and a live workspace indicator. `onOpenNav` is
 * only relevant below md, where the persistent Sidebar (and its
 * WorkspaceSwitcher) is replaced by MobileNavDrawer.
 */
export function TopBar({
  onOpenNav,
  onOpenCommandBar,
}: {
  onOpenNav: () => void
  onOpenCommandBar: () => void
}) {
  const greeting = useGreeting()

  return (
    <header className="flex flex-col gap-1 border-b border-[var(--color-border)] bg-[var(--surface-raised)] px-4 py-3 md:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="rounded-lg px-2 py-1 text-lg leading-none text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] md:hidden"
        >
          <span aria-hidden>☰</span>
        </button>
        <button
          type="button"
          onClick={onOpenCommandBar}
          className="ml-auto hidden items-center gap-2 rounded-control bg-[var(--surface-inset)] px-3 py-1.5 text-sm text-[var(--color-ink-muted)] shadow-inset transition-shadow hover:shadow-raised md:flex"
        >
          <span aria-hidden>✨</span>
          <span>Ask ARRIYIA...</span>
          <kbd className="ml-2 rounded-pill bg-[var(--surface-raised)] px-1.5 py-0.5 text-[0.65rem] text-[var(--color-ink-muted)]">
            ⌘K
          </kbd>
        </button>
        <div className="ml-auto flex items-center gap-1 md:ml-1">
          <button
            type="button"
            onClick={onOpenCommandBar}
            aria-label="Ask ARRIYIA"
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--surface-base)] hover:text-[var(--color-ink)] md:hidden"
          >
            ✨
          </button>
          <button
            type="button"
            disabled
            title="No notifications yet"
            aria-label="Notifications"
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-[var(--color-ink-muted)]/60 transition-colors"
          >
            🔔
          </button>
          <Link
            to="/settings"
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--surface-base)] hover:text-[var(--color-ink)]"
          >
            ⚙️
          </Link>
          <PlanIdentityBadge />
          <ProfileMenu />
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[var(--color-ink)] md:text-lg">{greeting.headline}</p>
          <p className="truncate text-sm text-[var(--color-ink-muted)]">{greeting.subtext}</p>
        </div>
        <WorkspacePresence />
      </div>
    </header>
  )
}
