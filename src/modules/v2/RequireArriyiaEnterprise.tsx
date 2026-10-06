import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * ARRIYIA Enterprise experience gate.
 *
 * This is a UI entitlement boundary only. NoVA Core remains authoritative for
 * plugin installation, capability resolution and execution authorization.
 * Platform admins retain access for certification and operations.
 */
export function RequireArriyiaEnterprise({ children }: { children: ReactNode }) {
  const plan = useCurrentPlan()
  const admin = usePlatformAdmin()

  if (plan.isLoading || admin.isLoading) {
    return (
      <div className="flex h-screen h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (admin.data === true || plan.data?.planCode === 'enterprise') {
    return children
  }

  return <Navigate to="/pricing" replace />
}
