import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { usePublicPlanCatalog } from '@/modules/plans/hooks/usePublicPlanCatalog'
import { startProCheckout } from '@/modules/billing/api/billing'
import type { PublicPlanTier } from '@/modules/plans/api/plans'
import { formatFileSize } from '@/modules/library/utils/fileTypes'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

// Phase 5C Commercial UX Exposure — plan/quota numbers shown here always
// come from live `plans`/`plan_quotas` data (usePublicPlanCatalog), never
// hardcoded copy — an admin editing a plan's quota in Admin -> Plans &
// Commercial is reflected here immediately. Only plan-independent
// marketing copy (what ARRIYIA *is*) stays static.
//
// LOCKED PRODUCT DECISION — AI provider invisibility: this page must
// never name an AI provider, mention "provider selection," or imply a
// user chooses which model answers them. That bullet existed here before
// this phase (a Phase 4 leftover predating the Phase 5A decision) and has
// been removed — ARRIYIA picks a provider automatically, always, on
// every plan.
const CORE_FEATURES = ['Documents, notes, knowledge graph & conversations', 'AI memory & personalization']

function formatPrice(cents: number | null, currency: string): string | null {
  if (cents === null) return null
  return `${(cents / 100).toLocaleString(undefined, { style: 'currency', currency })}`
}

function PlanCard({
  tier,
  isCurrent,
  isEligibleToUpgrade,
  onUpgradeClick,
  isStartingCheckout,
  checkoutError,
}: {
  tier: PublicPlanTier
  isCurrent: boolean
  isEligibleToUpgrade: boolean
  onUpgradeClick: () => void
  isStartingCheckout: boolean
  checkoutError: string | null
}) {
  const monthly = formatPrice(tier.monthlyPriceCents, tier.currency)
  const annual = formatPrice(tier.annualPriceCents, tier.currency)
  const isFree = tier.code === 'free'
  const isFoundingPro = tier.code === 'founding_pro'

  return (
    <SurfaceCard className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">{tier.name}</h2>
          {isCurrent && <StatusBadge label="Current plan" variant="info" />}
        </div>
        {isFree ? (
          <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">$0</p>
        ) : monthly ? (
          <div className="mt-1">
            <p className="text-2xl font-semibold text-[var(--color-ink)]">{monthly}/mo</p>
            {annual && <p className="text-xs text-[var(--color-ink-muted)]">or {annual}/yr</p>}
          </div>
        ) : isFoundingPro ? (
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Invite only</p>
        ) : (
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Pricing to be announced</p>
        )}
        {tier.description && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{tier.description}</p>}
      </div>

      <ul className="flex flex-1 flex-col gap-2 text-sm text-[var(--color-ink)]">
        {isFree && CORE_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
            {feature}
          </li>
        ))}
        {!isFree && (
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
            Everything in Free
          </li>
        )}
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
          {tier.aiMessagesPerMonth !== null ? `${tier.aiMessagesPerMonth.toLocaleString()} AI messages / month` : 'AI messages per month'}
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
          {tier.storageBytes !== null ? `${formatFileSize(tier.storageBytes)} storage` : 'Storage'}
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
          {tier.collaboration ? 'Invite teammates to your workspace' : 'Single-owner workspace'}
        </li>
        {isFoundingPro && (
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
            Terms locked in independently of future Pro changes
          </li>
        )}
      </ul>

      {tier.code === 'pro' && isCurrent && (
        <Link to="/settings">
          <Button variant="secondary">Manage billing</Button>
        </Link>
      )}

      {tier.code === 'pro' && !isCurrent && isEligibleToUpgrade && (
        <div className="flex flex-col gap-2">
          <Button onClick={onUpgradeClick} disabled={isStartingCheckout}>
            {isStartingCheckout ? 'Starting checkout…' : 'Upgrade to Pro (sandbox)'}
          </Button>
          <p className="text-xs text-[var(--color-ink-muted)]">Pesapal sandbox checkout — no real payment is processed.</p>
          {checkoutError && <p className="text-xs text-[var(--color-danger-strong)]">{checkoutError}</p>}
        </div>
      )}

      {isFoundingPro && (
        <p className="text-xs text-[var(--color-ink-muted)]">
          Founding Pro is assigned to early ARRIYIA members and isn't available through self-serve checkout.
        </p>
      )}
    </SurfaceCard>
  )
}

export function PricingPage() {
  const { data: currentPlan, isLoading: planLoading } = useCurrentPlan()
  const { data: catalog, isLoading: catalogLoading } = usePublicPlanCatalog()
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)

  // Phase 5B Pesapal Sandbox Billing — server resolves everything; this
  // click sends only a fixed intent, never a price or plan id (see
  // pesapal-checkout/index.ts). If Pesapal isn't configured for this
  // environment the function fails closed with a 501, surfaced here as an
  // honest inline error rather than a silent no-op or a fake success.
  async function handleUpgradeClick() {
    setCheckoutError(null)
    setIsStartingCheckout(true)
    try {
      const { redirectUrl } = await startProCheckout()
      window.location.href = redirectUrl
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout is unavailable right now. Please try again later.')
      setIsStartingCheckout(false)
    }
  }

  if (catalogLoading || !catalog) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  // Founding Pro must never present as an ordinary public checkout
  // option — only shown here when it's the viewer's own plan, so they
  // can see their current terms. No accidental upgrade/downgrade path
  // out of Founding Pro exists anywhere on this page.
  const visibleTiers = catalog.filter((tier) => tier.code !== 'founding_pro' || currentPlan?.planCode === 'founding_pro')

  // A Pro upgrade CTA is only offered once we know for certain the viewer
  // isn't already on Pro, Founding Pro, or Enterprise — never while the
  // plan is still loading, and never for a plan this page doesn't
  // recognize as "eligible to become Pro."
  const isEligibleToUpgrade = !planLoading && !!currentPlan && !['pro', 'founding_pro', 'enterprise'].includes(currentPlan.planCode)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Plans</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Free is useful on its own. Pro adds capacity and collaboration when you need it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {visibleTiers.map((tier) => (
          <PlanCard
            key={tier.code}
            tier={tier}
            isCurrent={currentPlan?.planCode === tier.code}
            isEligibleToUpgrade={isEligibleToUpgrade}
            onUpgradeClick={handleUpgradeClick}
            isStartingCheckout={isStartingCheckout}
            checkoutError={checkoutError}
          />
        ))}
      </div>
    </div>
  )
}
