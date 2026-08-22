import { useEffect, useRef } from 'react'

export interface EdgeDrawerDialogProps {
  open: boolean
  onClose: () => void
  ariaLabel: string
  children: React.ReactNode
}

/**
 * Shared left-edge drawer chrome for MobileNavDrawer, MobileConversationDrawer,
 * and MobileCollectionsDrawer — one implementation so "outside click closes
 * it" only has to be fixed once and can never drift between the three.
 *
 * Built on native <dialog> (showModal/close): Esc-to-close and returning
 * focus to whatever was focused before the drawer opened are both free from
 * the browser, no extra code needed. The one thing <dialog> doesn't give you
 * is backdrop click-to-close, so this adds it — the panel content is wrapped
 * in its own div that stops click propagation, so the dialog's own onClick
 * only ever fires for a genuine click on the ::backdrop (which the browser
 * targets at the dialog element itself), never for a click anywhere inside
 * the visible drawer, including its own padding.
 */
export function EdgeDrawerDialog({ open, onClose, ariaLabel, children }: EdgeDrawerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      onClick={onClose}
      aria-label={ariaLabel}
      // h-dvh after h-full — same reasoning as AppShell's own h-screen/h-dvh
      // pairing: on iOS Safari, a fixed-position element sized via 100%/
      // inset-y-0 alone is measured against the *large* viewport (address
      // bar collapsed), which can be taller than what's actually visible
      // when the toolbar is showing. That's what let the underlying page's
      // content (including the Chat composer) show through/beneath the
      // drawer near the bottom — the drawer's own box didn't reach the
      // real bottom edge of the visible screen. h-dvh tracks the current
      // dynamic viewport instead, so the drawer (and its ::backdrop, which
      // already covers the full viewport and intercepts all pointer events
      // on the underlying app) always reach the true visible bottom.
      className="fixed inset-y-0 left-0 m-0 h-full h-dvh max-h-none w-64 max-w-[80vw] border-0 bg-transparent p-0 backdrop:bg-black/30"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]"
      >
        {children}
      </div>
    </dialog>
  )
}
