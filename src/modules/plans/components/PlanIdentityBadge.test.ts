import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Phase 2.1 — the persistent plan identity indicator in TopBar. Mirrors
 * PricingPage.test.ts's mocking convention: hook modules are mocked
 * wholesale rather than exercising react-query/Supabase for real.
 */

const { useAuthMock, useCurrentPlanMock, useMyFoundingProMembershipMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useCurrentPlanMock: vi.fn(),
  useMyFoundingProMembershipMock: vi.fn(),
}))

vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))
vi.mock('@/modules/plans/hooks/useCurrentPlan', () => ({ useCurrentPlan: useCurrentPlanMock }))
vi.mock('@/modules/founding-pro/hooks/useMyFoundingProStatus', () => ({ useMyFoundingProMembership: useMyFoundingProMembershipMock }))

import { PlanIdentityBadge } from '@/modules/plans/components/PlanIdentityBadge'

function renderBadge() {
  return render(createElement(MemoryRouter, null, createElement(PlanIdentityBadge)))
}

afterEach(cleanup)

describe('PlanIdentityBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMyFoundingProMembershipMock.mockReturnValue({ data: null, isLoading: false })
  })

  it('does not render when there is no authenticated user', () => {
    useAuthMock.mockReturnValue({ user: null })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: false })

    const { container } = renderBadge()

    expect(container.firstChild).toBeNull()
  })

  it('does not render while the plan is still loading, to avoid flashing the wrong plan', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })
    useCurrentPlanMock.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = renderBadge()

    expect(container.firstChild).toBeNull()
  })

  it('displays Free with an upgrade cue for a user with no explicit plan assignment, linking to /pricing', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })
    useCurrentPlanMock.mockReturnValue({ data: null, isLoading: false })

    renderBadge()

    expect(screen.getByText('Free')).not.toBeNull()
    expect(screen.getByText('Upgrade available')).not.toBeNull()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pricing')
  })

  it('displays Pro for a Pro user, linking to /pricing', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-pro', planCode: 'pro', planName: 'Pro' }, isLoading: false })

    renderBadge()

    expect(screen.getByText('Pro')).not.toBeNull()
    expect(screen.queryByText('Upgrade available')).toBeNull()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pricing')
  })

  it('displays Founding Pro with a member number for a Founding Pro user, linking to /pricing', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-founding', planCode: 'founding_pro', planName: 'Founding Pro' }, isLoading: false })
    useMyFoundingProMembershipMock.mockReturnValue({
      data: {
        id: 'member-1',
        user_id: 'u1',
        application_id: null,
        slot_type: 'public',
        founding_member_number: 7,
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

    renderBadge()

    expect(screen.getByText('Founding Pro')).not.toBeNull()
    expect(screen.getByText('Founding Member #7')).not.toBeNull()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pricing')
  })

  it('displays Founding Pro with no member-number line when membership data has no number yet (e.g. grandfathered)', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-founding', planCode: 'founding_pro', planName: 'Founding Pro' }, isLoading: false })

    renderBadge()

    expect(screen.getByText('Founding Pro')).not.toBeNull()
    expect(screen.queryByText(/Founding Member #/)).toBeNull()
  })

  it('displays Business for the existing enterprise plan code, linking to /pricing', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-ent', planCode: 'enterprise', planName: 'Enterprise' }, isLoading: false })

    renderBadge()

    expect(screen.getByText('Business')).not.toBeNull()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pricing')
  })

  it('never exposes the internal member row id anywhere in the rendered output', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })
    useCurrentPlanMock.mockReturnValue({ data: { planId: 'plan-founding', planCode: 'founding_pro', planName: 'Founding Pro' }, isLoading: false })
    useMyFoundingProMembershipMock.mockReturnValue({
      data: {
        id: 'member-1',
        user_id: 'u1',
        application_id: null,
        slot_type: 'public',
        founding_member_number: 7,
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

    renderBadge()

    expect(document.body.textContent ?? '').not.toContain('member-1')
  })
})
