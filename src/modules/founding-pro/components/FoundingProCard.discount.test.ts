import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { FoundingProMember } from '@/shared/types/database'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  capacity: vi.fn(),
  membership: vi.fn(),
  application: vi.fn(),
  invitation: vi.fn(),
  catalog: vi.fn(),
}))

vi.mock('@/modules/auth/useAuth', () => ({ useAuth: mocks.auth }))
vi.mock('@/modules/founding-pro/hooks/useFoundingProCapacity', () => ({ useFoundingProCapacity: mocks.capacity }))
vi.mock('@/modules/founding-pro/hooks/useMyFoundingProStatus', () => ({
  useMyFoundingProMembership: mocks.membership,
  useMyLatestFoundingProApplication: mocks.application,
  useMyPendingFoundingProInvitation: mocks.invitation,
}))
vi.mock('@/modules/plans/hooks/usePublicPlanCatalog', () => ({ usePublicPlanCatalog: mocks.catalog }))
vi.mock('@/modules/billing/api/billing', () => ({ startProCheckout: vi.fn() }))

import { FoundingProCard } from '@/modules/founding-pro/components/FoundingProCard'

function member(overrides: Partial<FoundingProMember> = {}): FoundingProMember {
  return {
    id: 'member-1', user_id: 'user-1', application_id: 'app-1', slot_type: 'public', founding_member_number: 7,
    founding_price_cents: 3940, currency: 'USD', founding_started_at: '2026-06-01T00:00:00Z',
    founding_expires_at: '2026-09-01T00:00:00Z', transition_status: 'active', transitioned_at: null,
    created_at: '2026-06-01T00:00:00Z', ...overrides,
  }
}

describe('FoundingProCard discount presentation', () => {
  beforeEach(() => {
    mocks.auth.mockReturnValue({ user: { id: 'user-1' } })
    mocks.capacity.mockReturnValue({ data: { maxPublicSlots: 100, enrolledPublicCount: 10, remainingPublicSlots: 90 }, isLoading: false })
    mocks.application.mockReturnValue({ data: null, isLoading: false })
    mocks.invitation.mockReturnValue({ data: null, isLoading: false })
    mocks.catalog.mockReturnValue({ data: [{ planId: 'pro', code: 'pro', name: 'Pro', description: null, active: true, monthlyPriceCents: 9900, annualPriceCents: 99000, currency: 'USD', aiMessagesPerMonth: 3000, storageBytes: 26843545600, collaboration: true, maxActiveCollaborators: 10 }], isLoading: false })
    mocks.membership.mockReturnValue({ data: member(), isLoading: false })
  })

  it('shows current Pro price, member founder price, and calculated discount', () => {
    render(createElement(MemoryRouter, null, createElement(FoundingProCard)))
    expect(screen.getByText('Pro $99.00/mo')).toBeTruthy()
    expect(screen.getByText('$39.40/mo')).toBeTruthy()
    expect(screen.getByText('Save 60%')).toBeTruthy()
  })

  it('does not invent a discount when Pro comparison data is unavailable', () => {
    mocks.catalog.mockReturnValue({ data: [], isLoading: false })
    cleanup()
    render(createElement(MemoryRouter, null, createElement(FoundingProCard)))
    expect(screen.getByText('$39.40/mo')).toBeTruthy()
    expect(screen.queryByText(/Save \d+%/)).toBeNull()
  })

  it('does not invent a discount when the Pro price and the founder price are in different currencies', () => {
    mocks.catalog.mockReturnValue({
      data: [{ planId: 'pro', code: 'pro', name: 'Pro', description: null, active: true, monthlyPriceCents: 9900, annualPriceCents: 99000, currency: 'EUR', aiMessagesPerMonth: 3000, storageBytes: 26843545600, collaboration: true, maxActiveCollaborators: 10 }],
      isLoading: false,
    })
    cleanup()
    render(createElement(MemoryRouter, null, createElement(FoundingProCard)))
    expect(screen.getByText('$39.40/mo')).toBeTruthy()
    expect(screen.queryByText(/Save \d+%/)).toBeNull()
    expect(screen.queryByText(/Pro €99\.00/)).toBeNull()
  })

  it('does not invent a discount when the founder price is not actually lower than the Pro price', () => {
    mocks.catalog.mockReturnValue({
      data: [{ planId: 'pro', code: 'pro', name: 'Pro', description: null, active: true, monthlyPriceCents: 2000, annualPriceCents: 20000, currency: 'USD', aiMessagesPerMonth: 3000, storageBytes: 26843545600, collaboration: true, maxActiveCollaborators: 10 }],
      isLoading: false,
    })
    mocks.membership.mockReturnValue({ data: member({ founding_price_cents: 3940 }), isLoading: false })
    cleanup()
    render(createElement(MemoryRouter, null, createElement(FoundingProCard)))
    expect(screen.getByText('$39.40/mo')).toBeTruthy()
    expect(screen.queryByText(/Save \d+%/)).toBeNull()
  })
})
