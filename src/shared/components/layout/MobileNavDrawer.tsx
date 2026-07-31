import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SidebarNav } from '@/shared/components/layout/Sidebar'
import { Button } from '@/shared/components/ui/Button'
import { EdgeDrawerDialog } from '@/shared/components/ui/EdgeDrawerDialog'

/**
 * Below md, this is the only way to reach primary navigation — the
 * persistent Sidebar is hidden there (see AppShell). Renders the exact
 * same SidebarNav content the desktop Sidebar does; no second nav-items
 * array, no duplicated markup.
 */
export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()

  // Navigating should always close the drawer — mirrors the "reset state on
  // route/conversation change" pattern already used in ChatPage/ReaderChatPanel.
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <EdgeDrawerDialog open={open} onClose={onClose} ariaLabel="Primary navigation">
      <div className="flex flex-col gap-1 p-4">
        <div className="mb-2 flex items-center justify-end">
          <Button variant="ghost" onClick={onClose} aria-label="Close navigation">
            Close
          </Button>
        </div>
        <SidebarNav />
      </div>
    </EdgeDrawerDialog>
  )
}
