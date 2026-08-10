import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { useMyFoundingProMembership } from '@/modules/founding-pro/hooks/useMyFoundingProStatus'
import { resolvePlanIdentity, type PlanIdentityKind } from '@/modules/plans/planIdentity'

const VARIANT_CLASSES: Record<PlanIdentityKind, string> = {
  free: 'bg-[var(--color-ink-muted)]/10 text-[var(--color-ink-muted)]',
  pro: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  founding_pro: 'bg-[var(--color-success-bg)] text-[var(--color-success-strong)]',
  business: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
}

/**
 * Phase 2.1 — the persistent plan identity indicator. Lives in TopBar
 * (see that file), which is the one shared identity surface rendered
 * unchanged on both desktop and mobile — no separate Sidebar/
 * MobileNavDrawer copy needed. Reuses useCurrentPlan() (the same
 * resolver PricingPage/BillingCard already use) and Phase 2's
 * useMyFoundingProMembership() for the optional founding-member number
 * — no second plan-resolution path.
 */
export function PlanIdentityBadge() {
  const { user } = useAuth()
  const { data: currentPlan, isLoading } = useCurrentPlan()
  const { data: membership } = useMyFoundingProMembership()

  if (!user || isLoading) return null

  const display = resolvePlanIdentity({
    planCode: currentPlan?.planCode ?? null,
    foundingMemberNumber: membership?.founding_member_number ?? null,
  })

  return (
    <Link
      to={display.href}
      aria-label={`Current plan: ${display.label}. View plans.`}
      className="flex flex-col items-start gap-0.5 rounded-control px-2 py-1 transition-colors hover:bg-[var(--surface-base)]"
    >
      <span className={`inline-flex rounded-pill px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${VARIANT_CLASSES[display.kind]}`}>
        {display.label}
      </span>
      {display.secondaryText && <span className="px-0.5 text-[0.65rem] text-[var(--color-ink-muted)]">{display.secondaryText}</span>}
    </Link>
  )
}
