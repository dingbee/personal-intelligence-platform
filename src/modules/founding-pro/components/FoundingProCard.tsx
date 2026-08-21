import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useFoundingProCapacity } from '@/modules/founding-pro/hooks/useFoundingProCapacity'
import {
  useMyFoundingProMembership,
  useMyLatestFoundingProApplication,
  useMyPendingFoundingProInvitation,
} from '@/modules/founding-pro/hooks/useMyFoundingProStatus'
import { resolveFoundingProDisplayState, type FoundingProDisplayState } from '@/modules/founding-pro/foundingProState'
import { startProCheckout } from '@/modules/billing/api/billing'
import { usePublicPlanCatalog } from '@/modules/plans/hooks/usePublicPlanCatalog'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { Button } from '@/shared/components/ui/Button'
import type { FoundingProMember } from '@/shared/types/database'

// LOCKED PRODUCT DECISIONS this card must honor, same as PricingPage's
// existing Pro/Free cards:
//   - Never name an AI provider, model, or provider-allocation concept —
//     "Full Pro functionality" stays generic on purpose.
//   - Never invent a founding price. The exact rate is confirmed to the
//     applicant only after an admin approves and enrolls them; this card
//     reads the member's actual founding_price_cents/currency.
//   - The ordinary Pro comparison price is always read from the live public
//     Pro plan catalog. It is never hard-coded.
// V1 Founding Pro Expiry — "Automatic transition to standard Pro" was
// inaccurate: expiry (expire_founding_pro_members(),
// 0072_founding_pro_expiry.sql) only keeps someone on Pro if they've
// separately, explicitly converted (normal Pro checkout) before their
// 3-month term ends; otherwise they return to Free, not Pro. This copy
// must state that honestly rather than implying Pro is the automatic
// outcome.
const FOUNDING_PRO_FEATURES = [
  'Everything in Pro, from day one',
  'Discounted founding rate for a 3-month founding term',
  'Move to standard Pro anytime during your term to keep full access afterward — otherwise you return to Free when it ends',
]

// Capability-progression messaging, matching PricingPage's CARD_COPY pattern
// (see that file's own comment) — presentational only, no effect on
// eligibility, capacity, or pricing logic below.
const FOUNDING_PRO_HEADLINE = 'Shape the Future of Personal Intelligence'
const FOUNDING_PRO_POSITIONING = 'Lead the evolution of personal intelligence'
const FOUNDING_PRO_VALUE_PROP = 'Use the complete Pro experience from the beginning — and help shape the product as personal intelligence evolves.'
const FOUNDING_PRO_CAPABILITY_BULLETS = [
  'Full Pro intelligence capabilities',
  'Early access to emerging capabilities',
  'Founder-level product participation',
  'Direct influence through early feedback',
  'Lock in founding access and benefits',
]

function formatMemberPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency })
}

function formatMemberDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function discountPercent(proPriceCents: number, foundingPriceCents: number): number {
  if (proPriceCents <= 0 || foundingPriceCents >= proPriceCents) return 0
  return Math.round(((proPriceCents - foundingPriceCents) / proPriceCents) * 100)
}

/** Whole days remaining until `expiresAt`, floored at 0 — never negative, so an already-past-due-but-not-yet-swept member reads as "0 days left," not a confusing negative count. */
function daysRemaining(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/**
 * V1 Founding Pro Expiry commercial UX — the member's own founding price/
 * dates, driving three distinct presentations by transition_status. Never
 * reuses founding_price_cents/currency once transition_status leaves
 * 'active' (that rate was for the 3-month founding term only, not a
 * standing discount), and never offers a "Renew Founding Pro" CTA — the
 * only paths forward are the existing Pro checkout (startProCheckout) or,
 * post-expiry, the existing Free->Pro upgrade path.
 */
function FoundingProMemberPanel({ member }: { member: FoundingProMember }) {
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: catalog } = usePublicPlanCatalog()
  const proPlan = catalog?.find((plan) => plan.code === 'pro')

  async function handleContinueWithPro() {
    setError(null)
    setIsStarting(true)
    try {
      const { redirectUrl } = await startProCheckout()
      window.location.href = redirectUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout is unavailable right now. Please try again later.')
      setIsStarting(false)
    }
  }

  if (member.transition_status === 'active') {
    const remaining = daysRemaining(member.founding_expires_at)
    const memberLabel = member.slot_type === 'public' && member.founding_member_number ? `Founding member #${member.founding_member_number}` : 'Founding Pro member'
    const proPriceMatchesCurrency = proPlan?.monthlyPriceCents != null && proPlan.currency === member.currency
    const discount = proPriceMatchesCurrency ? discountPercent(proPlan.monthlyPriceCents!, member.founding_price_cents) : 0

    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-muted)]">{memberLabel}</p>
          {proPriceMatchesCurrency && proPlan.monthlyPriceCents! > member.founding_price_cents ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-sm text-[var(--color-ink-muted)] line-through">
                Pro {formatMemberPrice(proPlan.monthlyPriceCents!, proPlan.currency)}/mo
              </p>
              <p className="text-2xl font-semibold text-[var(--color-ink)]">
                {formatMemberPrice(member.founding_price_cents, member.currency)}/mo
              </p>
              <span className="rounded-control bg-[var(--surface-inset)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
                Save {discount}%
              </span>
            </div>
          ) : (
            <p className="text-2xl font-semibold text-[var(--color-ink)]">
              {formatMemberPrice(member.founding_price_cents, member.currency)}/mo
            </p>
          )}
          <p className="text-xs text-[var(--color-ink-muted)]">
            Your founder price, locked in through {formatMemberDate(member.founding_expires_at)}
          </p>
        </div>
        <div className="rounded-control bg-[var(--surface-inset)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
          <span className="font-medium text-[var(--color-ink)]">{remaining}</span> day{remaining === 1 ? '' : 's'} left in your founding term
          <p className="mt-1">
            When your term ends, you'll move to the Free plan unless you continue with standard Pro before then.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={handleContinueWithPro} disabled={isStarting}>
            {isStarting ? 'Starting checkout…' : 'Continue with Pro'}
          </Button>
          {error && <p className="text-xs text-[var(--color-danger-strong)]">{error}</p>}
        </div>
      </div>
    )
  }

  if (member.transition_status === 'converted_to_pro') {
    return (
      <div className="rounded-control bg-[var(--surface-inset)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
        You moved to standard Pro{member.transitioned_at ? ` on ${formatMemberDate(member.transitioned_at)}` : ''}. Your Founding Pro rate ended with your
        founding term — see the Pro plan for your current billing.
      </div>
    )
  }

  // expired_to_free (or the legacy 'transitioned' value)
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-control bg-[var(--surface-inset)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
        Your founding term ended{member.transitioned_at ? ` on ${formatMemberDate(member.transitioned_at)}` : ''}. You're now on the Free plan.
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={handleContinueWithPro} disabled={isStarting}>
          {isStarting ? 'Starting checkout…' : 'Upgrade to Pro'}
        </Button>
        {error && <p className="text-xs text-[var(--color-danger-strong)]">{error}</p>}
      </div>
    </div>
  )
}

export function FoundingProCard() {
  const { user } = useAuth()
  const { data: capacity, isLoading: capacityLoading } = useFoundingProCapacity()
  const { data: membership, isLoading: membershipLoading } = useMyFoundingProMembership()
  const { data: latestApplication, isLoading: applicationLoading } = useMyLatestFoundingProApplication()
  const { data: pendingInvitation, isLoading: invitationLoading } = useMyPendingFoundingProInvitation()

  const state = resolveFoundingProDisplayState({
    isAuthenticated: Boolean(user),
    isLoading: Boolean(user) && (membershipLoading || applicationLoading || invitationLoading),
    membership: membership ?? null,
    latestApplication: latestApplication ?? null,
    pendingInvitation: pendingInvitation ?? null,
    remainingPublicSlots: capacity?.remainingPublicSlots ?? null,
  })

  return (
    <SurfaceCard className="flex flex-col gap-4 border-2 border-[var(--color-accent)]/30">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Founding Pro</h2>
          {state.kind === 'member' && state.member.transition_status === 'active' && <StatusBadge label="Your plan" variant="info" />}
        </div>
        <p className="mt-1 text-sm font-semibold text-[var(--color-accent)]">{FOUNDING_PRO_HEADLINE}</p>
        {state.kind !== 'member' && <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Discounted founding rate</p>}
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{FOUNDING_PRO_POSITIONING}</p>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{FOUNDING_PRO_VALUE_PROP}</p>
        {state.kind !== 'member' && (
          <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
            For our first 100 approved public members. Your exact rate is confirmed when your application is approved.
          </p>
        )}
      </div>

      {state.kind === 'member' && <FoundingProMemberPanel member={state.member} />}

      <div>
        <p className="text-xs font-medium text-[var(--color-ink-muted)]">What you can accomplish</p>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-[var(--color-ink)]">
          {FOUNDING_PRO_CAPABILITY_BULLETS.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <p className="text-xs font-medium text-[var(--color-ink-muted)]">What's included</p>
        <ul className="flex flex-col gap-2 text-sm text-[var(--color-ink)]">
          {FOUNDING_PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {state.kind !== 'member' && (
        <div className="rounded-control bg-[var(--surface-inset)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
          {capacityLoading || !capacity ? (
            'Loading capacity…'
          ) : (
            <>
              <span className="font-medium text-[var(--color-ink)]">{capacity.remainingPublicSlots}</span> of {capacity.maxPublicSlots} public spots
              remaining
            </>
          )}
        </div>
      )}

      <FoundingProCta state={state} />
    </SurfaceCard>
  )
}

function FoundingProCta({ state }: { state: FoundingProDisplayState }) {
  switch (state.kind) {
    case 'member':
      return null
    case 'anonymous':
      return (
        <div className="flex flex-col gap-2">
          <Link to="/signup">
            <Button className="w-full">Sign up to apply</Button>
          </Link>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--color-accent)] hover:underline">
              Log in
            </Link>{' '}
            to apply.
          </p>
        </div>
      )
    case 'loading':
      return null
    case 'invited':
      return (
        <Link to="/founding-pro/invitation">
          <Button className="w-full">Accept your Founding Pro invitation</Button>
        </Link>
      )
    case 'application-pending':
      return (
        <StatusBadge
          label={state.status === 'approved' ? 'Application approved — enrollment pending' : 'Application pending'}
          variant="info"
        />
      )
    case 'capacity-full':
      return <p className="text-xs text-[var(--color-ink-muted)]">All public Founding Pro spots are filled right now.</p>
    case 'eligible-to-apply':
      return (
        <Link to="/founding-pro/apply">
          <Button className="w-full">Apply for Founding Pro</Button>
        </Link>
      )
  }
}
