import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/shared/components/layout/Sidebar'
import { TopBar } from '@/shared/components/layout/TopBar'
import { MobileNavDrawer } from '@/shared/components/layout/MobileNavDrawer'
import { NovaCommandBar } from '@/modules/commands/components/NovaCommandBar'
import { QuickCaptureDialog } from '@/modules/capture/components/QuickCaptureDialog'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)

  // Global Cmd/Ctrl+K — no existing keyboard-shortcut handling anywhere
  // else in the app to collide with. preventDefault stops the browser's
  // own Ctrl+K (address-bar search in some browsers) from firing too.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandBarOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // PIP Stabilization v1 (P1 mobile) — h-dvh (dynamic viewport height)
  // after h-screen (100vh) as a fallback: on iOS Safari, 100vh includes
  // the area the address bar/toolbar can cover, so h-screen alone can
  // size this shell taller than what's actually visible, pushing
  // bottom-of-shell content (like ChatInput) out of view. Browsers that
  // don't support dvh simply never parse the second declaration and
  // keep the h-screen fallback.
  return (
    <div className="flex h-screen h-dvh bg-[var(--surface-base)]">
      <Sidebar />
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <NovaCommandBar
        open={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        onOpenQuickCapture={() => setQuickCaptureOpen(true)}
      />
      <QuickCaptureDialog open={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setMobileNavOpen(true)} onOpenCommandBar={() => setCommandBarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
