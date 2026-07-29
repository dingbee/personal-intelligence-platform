import { NavLink } from 'react-router-dom'
import { appConfig } from '@/app/appConfig'
import { WorkspaceSwitcher } from '@/modules/workspaces/components/WorkspaceSwitcher'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/library', label: 'Library' },
  { to: '/knowledge', label: 'Knowledge' },
  { to: '/notes', label: 'Notes' },
  { to: '/search', label: 'Search' },
  { to: '/chat', label: 'Chat' },
  { to: '/settings', label: 'Settings' },
]

/**
 * The actual nav content — one navItems array, one set of markup, shared by
 * the persistent desktop Sidebar below and MobileNavDrawer. Neither wraps
 * this in its own <nav>; each supplies the surrounding chrome (fixed column
 * vs. dialog-drawer) appropriate to where it renders.
 */
export function SidebarNav() {
  return (
    <>
      <span className="mb-4 px-2 text-sm font-semibold tracking-tight text-[var(--color-ink)]">
        {appConfig.productName}
      </span>
      <WorkspaceSwitcher />
      {navItems.map((item) => (
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
