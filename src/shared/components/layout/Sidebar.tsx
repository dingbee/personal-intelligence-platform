import { NavLink } from 'react-router-dom'
import { appConfig } from '@/app/appConfig'
import { WorkspaceSwitcher } from '@/modules/workspaces/components/WorkspaceSwitcher'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'

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
  // Phase 5C — the only reachable path to /pricing was previously typing
  // the URL directly; nothing in primary nav, Settings, or anywhere else
  // linked to it. This is the single, minimal nav entry point Task 10
  // requires — not duplicated as a second "Upgrade" item, since the
  // existing quota/collaboration-denial CTAs and BillingCard's "View
  // plans" link already cover the in-context upgrade moments.
  { to: '/pricing', label: 'Pricing' },
  { to: '/settings', label: 'Settings' },
]

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
      <span className="mb-4 px-2 text-sm font-semibold tracking-tight text-[var(--color-ink)]">
        {appConfig.productName}
      </span>
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
