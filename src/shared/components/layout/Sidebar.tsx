import { NavLink } from 'react-router-dom'
import { appConfig } from '@/app/appConfig'
import { WorkspaceSwitcher } from '@/modules/workspaces/components/WorkspaceSwitcher'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { ArriyiaLogo } from '@/shared/components/branding/ArriyiaLogo'
import { ThemeToggle } from '@/shared/components/theme/ThemeToggle'

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

export function SidebarNav() {
  const { data: isAdmin } = usePlatformAdmin()
  const items = isAdmin ? [...navItems, { to: '/admin', label: 'Admin' }] : navItems

  return (
    <>
      <div className="sticky top-0 z-10 mb-4 flex items-center gap-2 rounded-lg bg-[var(--surface-raised)] px-2 py-1">
        <ArriyiaLogo className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="truncate text-sm font-semibold tracking-tight text-[var(--color-ink)]">
          {appConfig.productName}
        </span>
      </div>
      <WorkspaceSwitcher />
      <div className="mb-3 mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--surface-inset)] p-2">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">Appearance</p>
        <ThemeToggle />
      </div>
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
    </>
  )
}

/** Persistent on desktop only (md:flex) — below md, MobileNavDrawer is the way to reach navigation. */
export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--surface-raised)] p-4 md:flex"
    >
      <SidebarNav />
    </nav>
  )
}