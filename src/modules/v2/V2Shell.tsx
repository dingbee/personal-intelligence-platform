import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { ArriyiaLogo } from '@/shared/components/branding/ArriyiaLogo'
import { V2SpaceProvider } from './workspace/SpaceContext'
import { V2SpaceSwitcher } from './workspace/SpaceSwitcher'
import { listArriyiaV2Spaces } from './workspace/enterpriseSpaces'
import type { SpaceDescriptor } from './workspace/space'

export function V2Shell() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const spacesQuery = useQuery({
    queryKey: ['arriyia-v2-spaces', user?.id],
    queryFn: () => listArriyiaV2Spaces(user!.id),
    enabled: Boolean(user),
    staleTime: 30_000,
  })

  if (!user) return null

  const personalSpace: SpaceDescriptor = {
    id: `personal:${user.id}`,
    kind: 'personal',
    name: 'Personal',
    subscription: 'pro',
    status: 'active',
    ownerUserId: user.id,
  }

  const spaces = [personalSpace, ...(spacesQuery.data ?? [])]

  return (
    <V2SpaceProvider userId={user.id} spaces={spaces}>
      <div className="min-h-dvh bg-[var(--surface-base)] text-[var(--text-primary)]">
        <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <ArriyiaLogo className="h-9 w-9 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight">ARRIYIA Enterprise</div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {spacesQuery.isLoading ? 'Loading Spaces…' : 'Agentic intelligence platform'}
                </div>
              </div>
            </div>
            <V2SpaceSwitcher
              onBusinessSpaceCreated={() =>
                queryClient.invalidateQueries({ queryKey: ['arriyia-v2-spaces', user.id] })
              }
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </V2SpaceProvider>
  )
}
