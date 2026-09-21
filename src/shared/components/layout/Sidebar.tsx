import { NavLink } from 'react-router-dom'
import { appConfig } from '@/app/appConfig'
import { WorkspaceSwitcher } from '@/modules/workspaces/components/WorkspaceSwitcher'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { ArriyiaLogo } from '@/shared/components/branding/ArriyiaLogo'
import { ThemeToggle } from '@/shared/components/theme/ThemeToggle'

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
      <div className="sticky top-0 z-10 mb-4 flex items-center gap-2.5 bg-[var(--surface-raised)] px-2 py-2">
        <ArriyiaLogo className="h-9 w-9 shrink-0" />
        <span className="truncate text-base font-semibold tracking-tight text-[var(--color-ink)]">
          {appConfig.productName}
        </span>
      </div>
      <WorkspaceSwitcher />
      <div className="mb-3 mt-1 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--surface-inset)] p-2">
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">Appearance</p>
        <ThemeToggle />
      </div>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-[var(--color-canvas)] text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'}`}>
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

export function Sidebar() {
  return (
    <nav aria-label="Primary" className="hidden h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--surface-raised)] p-4 md:flex">
      <SidebarNav />
    </nav>
  )
}
