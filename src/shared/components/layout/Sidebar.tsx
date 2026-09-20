import { NavLink } from 'react-router-dom'
import { appConfig } from '@/app/appConfig'
import { WorkspaceSwitcher } from '@/modules/workspaces/components/WorkspaceSwitcher'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { ArriyiaLogo } from '@/shared/components/branding/ArriyiaLogo'
import { useTheme } from '@/shared/hooks/useTheme'

// UX-15.2 — Dashboard and Evolution dropped from top-level nav: their
// content folds into Hub's "Explore Deeper" zone as contextual links
// (see WorkspaceIntelligenceHubPage.tsx), closing the "four overlapping
// overview entries" finding from the phase's discovery doc (finding #5).
// Both routes still exist and are still reachable, just not as
// equally-weighted flat nav items competing with Hub.
const navItems = [
  { to: '/hub', label: 'Hub' },
  { to: '/collaboration', label: 'Collaboration' },
  { to: '/library', label: 'Library' },
  { to: '/knowledge', label: 'Knowledge' },
  { to: '/knowledge/export', label: 'Export Center' },
  { to: '/notes', label: 'Notes' },
  { to: '/search', label: 'Search' },
  { to: '/research', label: 'Research' },
  { to: '/planning', label: 'Planning' },
  { to: '/decisions', label: 'Decisions' },
  { to: '/actions', label: 'Actions' },
  { to: '/executions', label: 'Executions' },
  { to: '/learning', label: 'Learning' },
  { to: '/history', label: 'History' },
  { to: '/chat', label: 'Chat' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/settings', label: 'Settings' },
]

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="mt-3 flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[var(--color-accent)]">
          {isDark ? '☀' : '☾'}
        </span>
        <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
      </span>
      <span
        aria-hidden="true"
        className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
      >
        {isDark ? 'On' : 'Off'}
      </span>
    </button>
  )
}

/**
 * The actual nav content — one navItems array, one set of markup, shared by
 * the persistent desktop Sidebar below and MobileNavDrawer. Neither wraps
 * this in its own <nav>; each supplies the surrounding chrome (fixed column
 * vs. dialog-drawer) appropriate to where it renders.
 */
export function SidebarNav() {
  const { data: isAdmin } = usePlatformAdmin()
  const items = isAdmin ? [...navItems, { to: '/admin', label: 'Admin' }] : navItems

  return (
    <>
      <div className="mb-4 flex items-center gap-2 px-2">
        <ArriyiaLogo className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="truncate text-sm font-semibold tracking-tight text-[var(--color-ink)]">
          {appConfig.productName}
        </span>
      </div>
      <WorkspaceSwitcher />
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[var(--color-canvas)] text-[var(--color-ink)]'
                : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
      <ThemeToggle />
    </>
  )
}

/** Persistent on desktop only (md:flex) — below md, MobileNavDrawer is the way to reach navigation. */
export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-56 shrink-0 flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--surface-raised)] p-4 md:flex"
    >
      <SidebarNav />
    </nav>
  )
}
