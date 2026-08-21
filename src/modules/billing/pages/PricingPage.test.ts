import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Phase 5C fix — /pricing is a genuinely public route (router.tsx
 * deliberately does not nest it under the ProtectedRoute-wrapped '/'
 * subtree; see that file's own comment). These tests verify the part of
 * that guarantee this component itself is responsible for: it must never
 * redirect or blank-render based on auth state, must show Free/Pro
 * correctly whether or not a session exists, must never offer a
 * plan-inappropriate Pro CTA (anonymous visitors can't check out; a
 * current Pro user shouldn't see another checkout button; Founding
 * Pro/Enterprise viewers get no upgrade path at all), and must never
 * surface AI provider identity — the locked product decision from
 * Phase 5A.
 */

const {
  useAuthMock,
  useCurrentPlanMock,
  usePublicPlanCatalogMock,
  useFoundingProCapacityMock,
  useMyFoundingProMembershipMock,
  useMyLatestFoundingProApplicationMock,
  useMyPendingFoundingProInvitationMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useCurrentPlanMock: vi.fn(),
  usePublicPlanCatalogMock: vi.fn(),
  useFoundingProCapacityMock: vi.fn(),
  useMyFoundingProMembershipMock: vi.fn(),
  useMyLatestFoundingProApplicationMock: vi.fn(),
  useMyPendingFoundingProInvitationMock: vi.fn(),
}))

vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))
vi.mock('@/modules/plans/hooks/useCurrentPlan', () => ({ useCurrentPlan: useCurrentPlanMock }))
vi.mock('@/modules/plans/hooks/usePublicPlanCatalog', () => ({ usePublicPlanCatalog: usePublicPlanCatalogMock }))
vi.mock('@/modules/billing/api/billing', () => ({ startCheckout: vi.fn() }))
vi.mock('@/modules/founding-pro/hooks/useFoundingProCapacity', () => ({ useFoundingProCapacity: useFoundingProCapacityMock }))
vi.mock('@/modules/founding-pro/hooks/useMyFoundingProStatus', () => ({
  useMyFoundingProMembership: useMyFoundingProMembershipMock,
  useMyLatestFoundingProApplication: useMyLatestFoundingProApplicationMock,
  useMyPendingFoundingProInvitation: useMyPendingFoundingProInvitationMock,
}))

import { PricingPage } from '@/modules/billing/pages/PricingPage'
import { startCheckout } from '@/modules/billing/api/billing'

const freeTier = {
  planId: 'plan-free',
  code: 'free',
  name: 'Free',
  description: null,
  active: true,
  monthlyPriceCents: null,
  annualPriceCents: null,
  currency: 'USD',
  aiMessagesPerMonth: 100,
  storageBytes: 524288000,
  collaboration: true,
  maxActiveCollaborators: 1,
}
const proTier = {
  planId: 'plan-pro',
  code: 'pro',
  name: 'Pro',
  description: null,
  active: true,
  monthlyPriceCents: 1999,
  annualPriceCents: 19999,
  currency: 'USD',
  aiMessagesPerMonth: 10000,
  storageBytes: 5368709120,
  collaboration: true,
  maxActiveCollaborators: null,
}
const foundingProTier = { ...proTier, planId: 'plan-founding', code: 'founding_pro', name: 'Founding Pro' }
const studentTier = {
  planId: 'plan-student',
  code: 'student',
  name: 'Student',
  description: 'For students, researchers and academic users.',
  active: true,
  monthlyPriceCents: null,
  annualPriceCents: null,
  currency: 'USD',
  aiMessagesPerMonth: null,
  storageBytes: 524288000,
  collaboration: false,
  maxActiveCollaborators: null,
}

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(PricingPage)))
}

afterEach(cleanup)

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePublicPlanCatalogMock.mockReturnValue({ data: [freeTier, proTier, foundingProTier], isLoading: false })
    useFoundingProCapacityMock.mockReturnValue({ data: { maxPublicSlots: 100, enrolledPublicCount: 40, remainingPublicSlots: 60 }, isLoading: false })
    useMyFoundingProMembershipMock.mockReturnValue({ data: null, isLoading: false })
    useMyLatestFoundingProApplicationMock.mockReturnValue({ data: null, isLoading: false })
    useMyPendingFoundingProInvitationMock.mockReturnValue({ data: null, isLoading: false })
  })

  it('renders Free and Pro for a fully anonymous visitor (no session), with a sign-up CTA instead of checkout', () => {
    useAuthMock.mockReturnValue({ user: null, session: null })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })

    renderPage()

    // Plan names appear more than once on the page now — once as each
    // card's <h2> heading and again in the "Compare plans" full-capability
    // table (and, for Free specifically, a second time as the price
    // itself, since a Free card's price line also reads "Free" rather
    // than "$0"). Querying by heading role is what actually pins this
    // down to "the card titled X exists," not just "the word X appears
    // somewhere."
    const cards = within(screen.getByTestId('plan-cards'))
    expect(cards.getByRole('heading', { name: 'Free' })).not.toBeNull()
    expect(cards.getByRole('heading', { name: 'Pro' })).not.toBeNull()
    expect(screen.getByText('Sign up')).not.toBeNull()
    expect(screen.getByText('Free to sign up — subscribe to Pro anytime afterward.')).not.toBeNull()
    expect(screen.queryByText(/Subscribe to Pro/)).toBeNull()
  })

  it('shows the Founding Pro card publicly to an anonymous visitor, with live capacity and a sign-up CTA (Phase 2)', () => {
    useAuthMock.mockReturnValue({ user: null, session: null })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })

    renderPage()

    expect(within(screen.getByTestId('plan-cards')).getByText('Founding Pro')).not.toBeNull()
    expect(screen.getByText('60')).not.toBeNull()
    expect(screen.getByText('Sign up to apply')).not.toBeNull()
    expect(screen.queryByText('Apply for Founding Pro')).toBeNull()
  })

  it('shows the real sandbox checkout CTA for a signed-in Free user', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

    renderPage()

    expect(screen.getByText('Subscribe to Pro (sandbox)')).not.toBeNull()
    expect(screen.queryByText('Sign up')).toBeNull()
  })

  it('shows "Subscribe to Pro" and marks Free as current for a signed-in user with no explicit plan assignment row', () => {
    // Regression: getCurrentUserPlan() returns null for a user with no
    // active user_plan_assignments row — the real shape of a Free user in
    // this system (assign_default_plan() only ever assigns 'beta' on
    // signup, or nothing for pre-Phase-4 accounts; 'free' is never
    // actually assigned). Confirmed live in production: 2 of 5 real users
    // are in exactly this state. Previously `!currentPlan` was treated
    // the same as Founding Pro/Enterprise and hid the CTA entirely.
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: null, isLoading: false })

    renderPage()

    expect(screen.getByText('Subscribe to Pro (sandbox)')).not.toBeNull()
    expect(screen.queryByText('Sign up')).toBeNull()
    expect(screen.getByText('Current plan')).not.toBeNull()
  })

  it('invokes the existing Pesapal sandbox checkout path with the Pro plan code when a Free user clicks "Subscribe to Pro"', async () => {
    vi.mocked(startCheckout).mockResolvedValue({ redirectUrl: 'https://pesapal.example/checkout', merchantReference: 'ref-1' })
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

    renderPage()
    fireEvent.click(screen.getByText('Subscribe to Pro (sandbox)'))

    expect(startCheckout).toHaveBeenCalledTimes(1)
    expect(startCheckout).toHaveBeenCalledWith('pro')
  })

  it('shows "Manage billing" instead of another checkout button for a signed-in Pro user', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-pro', planCode: 'pro', planName: 'Pro' }, isLoading: false })

    renderPage()

    expect(screen.getByText('Manage billing')).not.toBeNull()
    expect(screen.queryByText(/Subscribe to Pro/)).toBeNull()
  })

  it('offers no Pro upgrade path at all for a Founding Pro viewer, and shows their own membership status instead of an application CTA', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1', email: 'founder@example.com' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-founding', planCode: 'founding_pro', planName: 'Founding Pro' }, isLoading: false })
    useMyFoundingProMembershipMock.mockReturnValue({
      data: {
        id: 'member-1',
        user_id: 'u1',
        application_id: null,
        slot_type: 'public',
        founding_member_number: 42,
        founding_price_cents: 1999,
        currency: 'USD',
        founding_started_at: '2026-01-01T00:00:00Z',
        founding_expires_at: '2026-04-01T00:00:00Z',
        transition_status: 'active',
        transitioned_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      isLoading: false,
    })

    renderPage()

    expect(within(screen.getByTestId('plan-cards')).getByText('Founding Pro')).not.toBeNull()
    expect(screen.getByText('Founding member #42')).not.toBeNull()
    expect(screen.queryByText(/Subscribe to Pro/)).toBeNull()
    expect(screen.queryByText('Manage billing')).toBeNull()
    expect(screen.queryByText('Sign up')).toBeNull()
    expect(screen.queryByText('Apply for Founding Pro')).toBeNull()
  })

  it('shows an Apply for Founding Pro CTA for an ordinary signed-in user with no application or membership yet', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u2' }, session: { user: { id: 'u2' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

    renderPage()

    expect(screen.getByText('Apply for Founding Pro')).not.toBeNull()
  })

  it('shows "Application pending" instead of a CTA for a signed-in user with a pending application', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u2' }, session: { user: { id: 'u2' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })
    useMyLatestFoundingProApplicationMock.mockReturnValue({
      data: { id: 'app-1', user_id: 'u2', status: 'pending', submitted_at: '2026-01-01T00:00:00Z', reviewed_at: null, reviewed_by: null, review_notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText('Application pending')).not.toBeNull()
    expect(screen.queryByText('Apply for Founding Pro')).toBeNull()
  })

  it('never mentions AI provider selection or shows a Pro CTA while the viewer\'s plan is still loading', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: true })

    renderPage()

    expect(screen.queryByText(/Subscribe to Pro/)).toBeNull()
    expect(screen.queryByText('Manage billing')).toBeNull()
    expect(screen.queryByText('Sign up')).toBeNull()
  })

  it('never renders AI provider names or "provider selection" language anywhere on the page', () => {
    useAuthMock.mockReturnValue({ user: null, session: null })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })

    renderPage()

    const bodyText = document.body.textContent ?? ''
    for (const forbidden of ['provider selection', 'Anthropic', 'OpenAI', 'Gemini', 'Claude']) {
      expect(bodyText).not.toContain(forbidden)
    }
  })

  it('shows a live quota number from the catalog, not hardcoded copy', () => {
    useAuthMock.mockReturnValue({ user: null, session: null })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })

    renderPage()

    expect(screen.getByText('10,000 AI messages / month')).not.toBeNull()
  })

  it('renders the Student card whenever the catalog includes it, with its value proposition and "pricing to be announced" (regression: Student plan invisible in production because it never reached the fetched catalog, not because of a rendering filter)', () => {
    useAuthMock.mockReturnValue({ user: null, session: null })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })
    usePublicPlanCatalogMock.mockReturnValue({ data: [freeTier, studentTier, proTier, foundingProTier], isLoading: false })

    renderPage()

    const cards = within(screen.getByTestId('plan-cards'))
    expect(cards.getByRole('heading', { name: 'Student' })).not.toBeNull()
    expect(cards.getByText('For students, researchers and academic users.')).not.toBeNull()
    expect(cards.getByText('Pricing to be announced')).not.toBeNull()
  })

  /**
   * Regression: the Student card previously had NO purchase/checkout CTA
   * at all — every CTA block in PlanCard was gated on `isPro` specifically,
   * so Student (and any future self-serve plan) silently got nothing,
   * regardless of auth/plan state. These tests cover the same CTA-state
   * matrix already covered for Pro above, now for Student, plus proof the
   * two cards' checkout buttons are launched and tracked independently.
   */
  describe('Student checkout CTA', () => {
    beforeEach(() => {
      usePublicPlanCatalogMock.mockReturnValue({ data: [freeTier, studentTier, proTier, foundingProTier], isLoading: false })
    })

    it('shows a sign-up CTA (not a checkout button) for an anonymous visitor', () => {
      useAuthMock.mockReturnValue({ user: null, session: null })
      useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })

      renderPage()

      expect(screen.getByText('Free to sign up — subscribe to Student anytime afterward.')).not.toBeNull()
      expect(screen.queryByText(/Subscribe to Student \(sandbox\)/)).toBeNull()
    })

    it('shows a working "Subscribe to Student (sandbox)" checkout button for a signed-in Free user', () => {
      useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
      useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

      renderPage()

      expect(screen.getByText('Subscribe to Student (sandbox)')).not.toBeNull()
      // Pro's own checkout button is still there too — the two are independent.
      expect(screen.getByText('Subscribe to Pro (sandbox)')).not.toBeNull()
    })

    it('shows "Manage billing" instead of a checkout button for a signed-in Student user', () => {
      useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
      useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-student', planCode: 'student', planName: 'Student' }, isLoading: false })

      renderPage()

      const cards = within(screen.getByTestId('plan-cards'))
      expect(cards.getAllByText('Manage billing')).toHaveLength(1)
      expect(screen.queryByText(/Subscribe to Student/)).toBeNull()
      // A Student user still sees Pro's own checkout button (switching self-serve plans is allowed).
      expect(screen.getByText('Subscribe to Pro (sandbox)')).not.toBeNull()
    })

    it('offers no Student checkout at all for a Founding Pro viewer', () => {
      useAuthMock.mockReturnValue({ user: { id: 'u1', email: 'founder@example.com' }, session: { user: { id: 'u1' } } })
      useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-founding', planCode: 'founding_pro', planName: 'Founding Pro' }, isLoading: false })
      useMyFoundingProMembershipMock.mockReturnValue({
        data: {
          id: 'member-1', user_id: 'u1', application_id: null, slot_type: 'public', founding_member_number: 42,
          founding_price_cents: 1999, currency: 'USD', founding_started_at: '2026-01-01T00:00:00Z',
          founding_expires_at: '2026-04-01T00:00:00Z', transition_status: 'active', transitioned_at: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        isLoading: false,
      })

      renderPage()

      expect(screen.queryByText(/Subscribe to Student/)).toBeNull()
    })

    it('launches the Student checkout via startCheckout("student"), independent of Pro\'s own checkout call', async () => {
      vi.mocked(startCheckout).mockResolvedValue({ redirectUrl: 'https://pesapal.example/student-checkout', merchantReference: 'ref-student-1' })
      useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
      useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

      renderPage()
      fireEvent.click(screen.getByText('Subscribe to Student (sandbox)'))

      expect(startCheckout).toHaveBeenCalledTimes(1)
      expect(startCheckout).toHaveBeenCalledWith('student')
    })

    it('shows a loading state only on the Student button while its checkout is starting, leaving Pro\'s button untouched', async () => {
      let resolveCheckout: (value: { redirectUrl: string; merchantReference: string }) => void = () => {}
      vi.mocked(startCheckout).mockImplementation(
        () => new Promise((resolve) => { resolveCheckout = resolve }),
      )
      useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
      useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

      renderPage()
      fireEvent.click(screen.getByText('Subscribe to Student (sandbox)'))

      expect(await screen.findByText('Starting checkout…')).not.toBeNull()
      expect(screen.getByText('Subscribe to Pro (sandbox)')).not.toBeNull()

      resolveCheckout({ redirectUrl: 'https://pesapal.example/x', merchantReference: 'ref' })
    })

    it('shows a checkout error only on the Student card when its checkout fails, leaving Pro unaffected', async () => {
      vi.mocked(startCheckout).mockRejectedValueOnce(new Error('Student checkout is unavailable'))
      useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
      useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

      renderPage()
      fireEvent.click(screen.getByText('Subscribe to Student (sandbox)'))

      expect(await screen.findByText('Student checkout is unavailable')).not.toBeNull()
      expect(screen.getByText('Subscribe to Pro (sandbox)')).not.toBeNull()
    })
  })
})
