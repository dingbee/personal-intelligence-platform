import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
}

export function DropdownMenu({ trigger, children }: DropdownMenuProps) {
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
        className="rounded-md p-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-md"
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
      className={`block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-canvas)] ${
        danger ? 'text-red-600' : 'text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  )
}
