import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/library', label: 'Library' },
  { to: '/notes', label: 'Notes' },
  { to: '/search', label: 'Search' },
  { to: '/chat', label: 'Chat' },
  { to: '/settings', label: 'Settings' },
]

export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <span className="mb-4 px-2 text-sm font-semibold tracking-tight text-[var(--color-ink)]">
        Second Brain
      </span>
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
    </nav>
  )
}
