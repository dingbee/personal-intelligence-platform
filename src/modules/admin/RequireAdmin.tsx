import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Sits inside ProtectedRoute (session auth already guaranteed by the
 * parent route) — this only adds the platform-admin check. A non-admin
 * is redirected to the workspace home, not /login (they're a valid,
 * authenticated user; they just aren't a founder).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: isAdmin, isLoading } = usePlatformAdmin()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
