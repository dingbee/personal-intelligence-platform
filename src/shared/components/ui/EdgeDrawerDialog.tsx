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
      className="fixed inset-y-0 left-0 m-0 h-full max-h-none w-64 max-w-[80vw] border-0 bg-transparent p-0 backdrop:bg-black/30"
    >
      <div onClick={(event) => event.stopPropagation()} className="flex h-full w-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        {children}
      </div>
    </dialog>
  )
}
