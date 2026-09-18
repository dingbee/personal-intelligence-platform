import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  /**
   * Overrides the panel's width class (default `w-40`) for consumers that
   * need a wider panel, e.g. the notification bell. When `responsiveOnMobile`
   * is set, this is applied under an `md:` prefix (e.g. pass `md:w-80`,
   * not `w-80`) — Tailwind's class scanner only picks up literal class
   * strings from source, so the `md:` has to already be part of the
   * string the caller supplies rather than something this component could
   * prepend at runtime.
   */
  panelClassName?: string
  /**
   * BUG-002 — the panel normally anchors to the *trigger's own* local
   * position (`absolute right-0` inside a `relative inline-block`
   * wrapper), which only stays on-screen if the trigger itself is near
   * the viewport's right edge. That's true for a lone icon at the far
   * right of a header, but not for one with several sibling controls to
   * its right (e.g. NotificationBell, which has Settings/PlanIdentityBadge/
   * ProfileMenu after it) — a wide panel can then extend past the left
   * edge of a narrow phone screen with no way to know how much room is
   * actually available from CSS alone. Below `md`, this switches the
   * panel to `fixed inset-x-4` — anchored to the *viewport* instead of the
   * trigger, with a fixed 1rem gutter on each side, so its width and
   * position are always exactly "the available viewport width minus
   * mobile gutters," regardless of where the trigger sits in a crowded
   * header. At `md` and up, positioning reverts to the original
   * trigger-anchored behavior, unchanged. Opt-in — every existing
   * DropdownMenu consumer (ProfileMenu, WorkspaceCard, ActionMenu, ...)
   * is completely unaffected unless it explicitly sets this.
   */
  responsiveOnMobile?: boolean
}

export function DropdownMenu({ trigger, children, panelClassName, responsiveOnMobile }: DropdownMenuProps) {
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
          className={
            responsiveOnMobile
              ? `fixed inset-x-4 top-14 z-10 md:absolute md:inset-x-auto md:left-auto md:top-auto md:right-0 md:mt-1 overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] py-1 shadow-floating ${panelClassName ?? 'md:w-40'}`
              : `absolute right-0 z-10 mt-1 ${panelClassName ?? 'w-40'} overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] py-1 shadow-floating`
          }
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
