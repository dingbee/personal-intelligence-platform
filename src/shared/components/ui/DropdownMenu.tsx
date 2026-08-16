import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  /** Overrides the panel's width class (default `w-40`) for consumers that need a wider panel, e.g. the notification bell. */
  panelClassName?: string
}

export function DropdownMenu({ trigger, children, panelClassName }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-control p-1 text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--surface-base)] hover:text-[var(--color-ink)]"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={`absolute right-0 z-10 mt-1 ${panelClassName ?? 'w-40'} overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] py-1 shadow-floating`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DropdownMenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-base)] ${
        danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  )
}
