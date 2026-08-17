import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useFoundingProCapacity } from '@/modules/founding-pro/hooks/useFoundingProCapacity'
import {
  useMyFoundingProMembership,
  useMyLatestFoundingProApplication,
  useMyPendingFoundingProInvitation,
} from '@/modules/founding-pro/hooks/useMyFoundingProStatus'
import { resolveFoundingProDisplayState, type FoundingProDisplayState } from '@/modules/founding-pro/foundingProState'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { Button } from '@/shared/components/ui/Button'

// LOCKED PRODUCT DECISIONS this card must honor, same as PricingPage's
// existing Pro/Free cards:
//   - Never name an AI provider, model, or provider-allocation concept —
//     "Full Pro functionality" stays generic on purpose.
//   - Never invent a founding price. The exact rate is confirmed to the
//     applicant only after an admin approves and enrolls them (a later
//     phase's concern); this card never reads plans.founding_pro's own
//     monthly_price_cents, which is a different, unrelated concept (see
//     0052's own comment on admin_enroll_founding_pro_member).
const FOUNDING_PRO_FEATURES = [
  'Everything in Pro, from day one',
  'Discounted founding rate for your first 3 months',
  'Automatic transition to standard Pro once your founding period ends',
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
          {state.kind === 'member' && <StatusBadge label="Your plan" variant="info" />}
        </div>
        <p className="mt-1 text-sm font-semibold text-[var(--color-accent)]">{FOUNDING_PRO_HEADLINE}</p>
        <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Discounted founding rate</p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{FOUNDING_PRO_POSITIONING}</p>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{FOUNDING_PRO_VALUE_PROP}</p>
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          For our first 100 approved public members. Your exact rate is confirmed when your application is approved.
        </p>
      </div>

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

      <FoundingProCta state={state} />
    </SurfaceCard>
  )
}

function FoundingProCta({ state }: { state: FoundingProDisplayState }) {
  switch (state.kind) {
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
    case 'member': {
      const label =
        state.member.slot_type === 'public' && state.member.founding_member_number
          ? `Founding member #${state.member.founding_member_number}`
          : 'Founding Pro member'
      return <p className="text-sm font-medium text-[var(--color-ink)]">{label}</p>
    }
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
