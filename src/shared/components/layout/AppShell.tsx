import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/shared/components/layout/Sidebar'
import { TopBar } from '@/shared/components/layout/TopBar'

export function AppShell() {
  return (
    <div className="flex h-screen bg-[var(--color-canvas)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
