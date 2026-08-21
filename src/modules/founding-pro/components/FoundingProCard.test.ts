import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { FoundingProMember } from '@/shared/types/database'

/**
 * V1 Founding Pro Expiry commercial UX — an enrolled member must see their
 * own real founding_price_cents/currency and founding_expires_at (never a
 * hardcoded or ordinary-Pro price), a "Continue with Pro" CTA routed
 * through the existing startProCheckout, and — once transition_status
 * leaves 'active' — never the founding price again and never a "renew"
 * offer: converted_to_pro shows a neutral historical note with no CTA,
 * expired_to_free shows Free-plan framing with an ordinary "Upgrade to
 * Pro" CTA (also via startProCheckout, never founding pricing).
 */

const { useAuthMock, useFoundingProCapacityMock, useMyFoundingProMembershipMock, useMyLatestFoundingProApplicationMock, useMyPendingFoundingProInvitationMock, startProCheckoutMock } =
  vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    useFoundingProCapacityMock: vi.fn(),
    useMyFoundingProMembershipMock: vi.fn(),
    useMyLatestFoundingProApplicationMock: vi.fn(),
    useMyPendingFoundingProInvitationMock: vi.fn(),
    startProCheckoutMock: vi.fn(),
  }))

vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))
vi.mock('@/modules/founding-pro/hooks/useFoundingProCapacity', () => ({ useFoundingProCapacity: useFoundingProCapacityMock }))
vi.mock('@/modules/founding-pro/hooks/useMyFoundingProStatus', () => ({
  useMyFoundingProMembership: useMyFoundingProMembershipMock,
  useMyLatestFoundingProApplication: useMyLatestFoundingProApplicationMock,
  useMyPendingFoundingProInvitation: useMyPendingFoundingProInvitationMock,
}))
vi.mock('@/modules/billing/api/billing', () => ({ startProCheckout: startProCheckoutMock }))

import { FoundingProCard } from '@/modules/founding-pro/components/FoundingProCard'

function renderCard() {
  return render(createElement(MemoryRouter, null, createElement(FoundingProCard)))
}

function baseMember(overrides: Partial<FoundingProMember>): FoundingProMember {
  return {
    id: 'member-1',
    user_id: 'user-1',
    application_id: 'app-1',
    slot_type: 'public',
    founding_member_number: 7,
    founding_price_cents: 1999,
    currency: 'USD',
    founding_started_at: '2026-06-01T00:00:00Z',
    founding_expires_at: '2026-09-01T00:00:00Z',
    transition_status: 'active',
    transitioned_at: null,
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

describe('FoundingProCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } })
    useFoundingProCapacityMock.mockReturnValue({ data: { maxPublicSlots: 100, enrolledPublicCount: 10, remainingPublicSlots: 90 }, isLoading: false })
    useMyLatestFoundingProApplicationMock.mockReturnValue({ data: null, isLoading: false })
    useMyPendingFoundingProInvitationMock.mockReturnValue({ data: null, isLoading: false })
  })

  afterEach(cleanup)

  it('shows the real per-member founding price and expiry date for an active member, never a hardcoded price', () => {
    useMyFoundingProMembershipMock.mockReturnValue({ data: baseMember({}), isLoading: false })
    renderCard()

    expect(screen.getByText('$19.99/mo')).not.toBeNull()
    expect(screen.getByText(/Founding member #7/)).not.toBeNull()
    expect(screen.getByText(/locked in through September 1, 2026/)).not.toBeNull()
  })

  it('shows remaining days and a Continue with Pro CTA for an active member', () => {
    useMyFoundingProMembershipMock.mockReturnValue({ data: baseMember({ founding_expires_at: new Date(Date.now() + 10 * 86400000).toISOString() }), isLoading: false })
    renderCard()

    expect(screen.getByText(/left in your founding term/)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Continue with Pro' })).not.toBeNull()
    expect(screen.queryByText(/Renew/i)).toBeNull()
  })

  it('routes the Continue with Pro CTA through the existing startProCheckout flow', async () => {
    useMyFoundingProMembershipMock.mockReturnValue({ data: baseMember({}), isLoading: false })
    startProCheckoutMock.mockResolvedValueOnce({ redirectUrl: 'https://pay.example.com/x', merchantReference: 'ref' })
    renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Pro' }))
    await Promise.resolve()

    expect(startProCheckoutMock).toHaveBeenCalledTimes(1)
  })

  it('shows the "Your plan" badge only while the founding term is still active', () => {
    useMyFoundingProMembershipMock.mockReturnValue({ data: baseMember({}), isLoading: false })
    renderCard()
    expect(screen.getByText('Your plan')).not.toBeNull()
  })

  it('does not show the founding price, an expiry warning, or any CTA once converted to standard Pro', () => {
    useMyFoundingProMembershipMock.mockReturnValue({
      data: baseMember({ transition_status: 'converted_to_pro', transitioned_at: '2026-07-15T00:00:00Z' }),
      isLoading: false,
    })
    renderCard()

    expect(screen.queryByText('$19.99/mo')).toBeNull()
    expect(screen.queryByText('Your plan')).toBeNull()
    expect(screen.queryByText(/left in your founding term/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Continue with Pro' })).toBeNull()
    expect(screen.getByText(/moved to standard Pro/)).not.toBeNull()
  })

  it('shows Free-plan framing and an ordinary Upgrade to Pro CTA (never the founding price, never a renewal offer) once expired to Free', () => {
    useMyFoundingProMembershipMock.mockReturnValue({
      data: baseMember({ transition_status: 'expired_to_free', transitioned_at: '2026-09-01T00:00:00Z' }),
      isLoading: false,
    })
    renderCard()

    expect(screen.queryByText('$19.99/mo')).toBeNull()
    expect(screen.queryByText('Your plan')).toBeNull()
    expect(screen.getByText(/now on the Free plan/)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).not.toBeNull()
    expect(screen.queryByText(/Renew/i)).toBeNull()
  })
})
