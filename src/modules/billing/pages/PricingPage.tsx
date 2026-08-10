import { useState } from 'react'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { startProCheckout } from '@/modules/billing/api/billing'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { Button } from '@/shared/components/ui/Button'

interface PlanTier {
  code: string
  name: string
  price: string
  description: string
  features: string[]
}

// Phase 4 Commercial Architecture — plan copy/pricing shown here is display
// text only, not an entitlement source: what a user can actually do is
// always resolved server-side (plan_quotas / has_feature / resolve_-
// effective_quota_limit). This page never grants anything itself. Exact
// prices are a business decision this file does not make — "Contact us"
// stands in for a real hosted-checkout price until a payment provider is
// selected (see the billing-webhook Edge Function's header comment).
const TIERS: PlanTier[] = [
  {
    code: 'free',
    name: 'Free',
    price: '$0',
    description: 'The full personal intelligence workspace, with room to grow.',
    features: [
      'Documents, notes, knowledge graph & conversations',
      'AI memory & personalization',
      'Basic AI messages per month',
      '500 MB storage',
      'Single-owner workspace',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    price: 'Contact us',
    description: 'More AI capacity, more storage, and team collaboration.',
    features: [
      'Everything in Free',
      'Higher AI message capacity',
      '5 GB storage',
      'Invite teammates to your workspace',
      'AI provider selection',
    ],
  },
  {
    code: 'founding_pro',
    name: 'Founding Pro',
    price: 'Invite only',
    description: 'The Pro experience, with grandfathered early-adopter terms.',
    features: ['Everything in Pro', 'Terms locked in independently of future Pro changes'],
  },
]

export function PricingPage() {
  const { data: currentPlan } = useCurrentPlan()
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Plans</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Free is useful on its own. Pro adds capacity and collaboration when you need it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIERS.map((tier) => {
          const isCurrent = currentPlan?.planCode === tier.code
          return (
            <SurfaceCard key={tier.code} className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--color-ink)]">{tier.name}</h2>
                  {isCurrent && <StatusBadge label="Current plan" variant="info" />}
                </div>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{tier.price}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{tier.description}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2 text-sm text-[var(--color-ink)]">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              {tier.code === 'pro' && !isCurrent && (
                <div className="flex flex-col gap-2">
                  <Button onClick={handleUpgradeClick} disabled={isStartingCheckout}>
                    {isStartingCheckout ? 'Starting checkout…' : 'Upgrade to Pro (sandbox)'}
                  </Button>
                  <p className="text-xs text-[var(--color-ink-muted)]">Pesapal sandbox checkout — no real payment is processed.</p>
                  {checkoutError && <p className="text-xs text-[var(--color-danger-strong)]">{checkoutError}</p>}
                </div>
              )}
              {tier.code === 'founding_pro' && (
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Founding Pro is assigned to early ARRIYIA members and isn't available through self-serve checkout.
                </p>
              )}
            </SurfaceCard>
          )
        })}
      </div>
    </div>
  )
}
