import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useHasProIntelligence } from '@/modules/plans/hooks/useHasProIntelligence'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Phase P0 Pro Intelligence Foundation — the reusable route guard future
 * Advanced AI Workspace / Research / Planning / Deep Academic Intelligence
 * routes wrap themselves in, mirroring RequireAdmin's exact shape. Sits
 * inside ProtectedRoute (session auth already guaranteed by the parent
 * route) — this only adds the Pro Intelligence entitlement check. A user
 * without it is redirected to /pricing, not /login — they're a valid,
 * authenticated user who simply isn't entitled yet.
 *
 * No route uses this guard yet: Phase P0 is architecture-only and
 * deliberately does not implement the individual intelligence products
 * (see docs). It's fully tested and ready for the first Pro-only route
 * that needs it.
 */
export function RequireProIntelligence({ children }: { children: ReactNode }) {
  const { data: hasProIntelligence, isLoading } = useHasProIntelligence()

  if (isLoading) {
    return (
      <div className="flex h-screen h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!hasProIntelligence) {
    return <Navigate to="/pricing" replace />
  }

  return children
}
