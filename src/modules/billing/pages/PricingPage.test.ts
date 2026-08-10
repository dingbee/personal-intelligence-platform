import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

const { useAuthMock, useCurrentPlanMock, usePublicPlanCatalogMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useCurrentPlanMock: vi.fn(),
  usePublicPlanCatalogMock: vi.fn(),
}))

vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))
vi.mock('@/modules/plans/hooks/useCurrentPlan', () => ({ useCurrentPlan: useCurrentPlanMock }))
vi.mock('@/modules/plans/hooks/usePublicPlanCatalog', () => ({ usePublicPlanCatalog: usePublicPlanCatalogMock }))
vi.mock('@/modules/billing/api/billing', () => ({ startProCheckout: vi.fn() }))

import { PricingPage } from '@/modules/billing/pages/PricingPage'
import { startProCheckout } from '@/modules/billing/api/billing'

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
  collaboration: false,
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
}
const foundingProTier = { ...proTier, planId: 'plan-founding', code: 'founding_pro', name: 'Founding Pro' }

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(PricingPage)))
}

afterEach(cleanup)

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePublicPlanCatalogMock.mockReturnValue({ data: [freeTier, proTier, foundingProTier], isLoading: false })
  })

  it('renders Free and Pro for a fully anonymous visitor (no session), with a sign-up CTA instead of checkout', () => {
    useAuthMock.mockReturnValue({ user: null, session: null })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })

    renderPage()

    expect(screen.getByText('Free')).not.toBeNull()
    expect(screen.getByText('Pro')).not.toBeNull()
    expect(screen.getByText('Sign up to get started')).not.toBeNull()
    expect(screen.queryByText(/Upgrade to Pro/)).toBeNull()
  })

  it('never shows Founding Pro to an anonymous visitor', () => {
    useAuthMock.mockReturnValue({ user: null, session: null })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })

    renderPage()

    expect(screen.queryByText('Founding Pro')).toBeNull()
  })

  it('shows the real sandbox checkout CTA for a signed-in Free user', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

    renderPage()

    expect(screen.getByText('Upgrade to Pro (sandbox)')).not.toBeNull()
    expect(screen.queryByText('Sign up to get started')).toBeNull()
  })

  it('shows "Upgrade to Pro" and marks Free as current for a signed-in user with no explicit plan assignment row', () => {
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

    expect(screen.getByText('Upgrade to Pro (sandbox)')).not.toBeNull()
    expect(screen.queryByText('Sign up to get started')).toBeNull()
    expect(screen.getByText('Current plan')).not.toBeNull()
  })

  it('invokes the existing Pesapal sandbox checkout path when a Free user clicks "Upgrade to Pro"', async () => {
    vi.mocked(startProCheckout).mockResolvedValue({ redirectUrl: 'https://pesapal.example/checkout', merchantReference: 'ref-1' })
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-free', planCode: 'free', planName: 'Free' }, isLoading: false })

    renderPage()
    fireEvent.click(screen.getByText('Upgrade to Pro (sandbox)'))

    expect(startProCheckout).toHaveBeenCalledTimes(1)
  })

  it('shows "Manage billing" instead of another checkout button for a signed-in Pro user', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-pro', planCode: 'pro', planName: 'Pro' }, isLoading: false })

    renderPage()

    expect(screen.getByText('Manage billing')).not.toBeNull()
    expect(screen.queryByText(/Upgrade to Pro/)).toBeNull()
  })

  it('offers no Pro upgrade path at all for a Founding Pro viewer, and shows their own Founding Pro card instead', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-founding', planCode: 'founding_pro', planName: 'Founding Pro' }, isLoading: false })

    renderPage()

    expect(screen.getByText('Founding Pro')).not.toBeNull()
    expect(screen.queryByText(/Upgrade to Pro/)).toBeNull()
    expect(screen.queryByText('Manage billing')).toBeNull()
    expect(screen.queryByText('Sign up to get started')).toBeNull()
  })

  it('never mentions AI provider selection or shows a Pro CTA while the viewer\'s plan is still loading', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, session: { user: { id: 'u1' } } })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: true })

    renderPage()

    expect(screen.queryByText(/Upgrade to Pro/)).toBeNull()
    expect(screen.queryByText('Manage billing')).toBeNull()
    expect(screen.queryByText('Sign up to get started')).toBeNull()
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
})
