import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { SidebarNav } from '@/shared/components/layout/Sidebar'
import { Button } from '@/shared/components/ui/Button'

/**
 * Below md, this is the only way to reach primary navigation — the
 * persistent Sidebar is hidden there (see AppShell). Built on the native
 * <dialog> element, the same pattern ConfirmDialog already established
 * (showModal()/close(), backdrop, Esc/backdrop-close via onCancel/onClose)
 * rather than a new modal library — just positioned as a left-edge drawer
 * instead of a centered dialog. Renders the exact same SidebarNav content
 * the desktop Sidebar does; no second nav-items array, no duplicated markup.
 */
export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const location = useLocation()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Navigating should always close the drawer — mirrors the "reset state on
  // route/conversation change" pattern already used in ChatPage/ReaderChatPanel.
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      aria-label="Primary navigation"
      className="fixed inset-y-0 left-0 m-0 h-full max-h-none w-64 max-w-[80vw] flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 open:flex backdrop:bg-black/30"
    >
      <div className="mb-2 flex items-center justify-end">
        <Button variant="ghost" onClick={onClose} aria-label="Close navigation">
          Close
        </Button>
      </div>
      <SidebarNav />
    </dialog>
  )
}
