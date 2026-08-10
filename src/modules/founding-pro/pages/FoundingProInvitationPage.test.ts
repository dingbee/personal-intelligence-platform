import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Founding Pro Programme Phase 4 — the protected acceptance page. Mirrors
 * FoundingProApplyPage's implicit reliance on ProtectedRoute (this test
 * renders the page directly, the same way a real authenticated session
 * would reach it). Covers: no invitation found, the read-only price
 * display never lets the user edit it, successful acceptance shows the
 * member number and a way back into ARRIYIA, and a failed acceptance
 * surfaces the real server error without silently succeeding.
 */

const { useAuthMock, useMyPendingFoundingProInvitationMock, useMyFoundingProMembershipMock, useAcceptFoundingProInvitationMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useMyPendingFoundingProInvitationMock: vi.fn(),
  useMyFoundingProMembershipMock: vi.fn(),
  useAcceptFoundingProInvitationMock: vi.fn(),
}))

vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))
vi.mock('@/modules/founding-pro/hooks/useMyFoundingProStatus', () => ({
  useMyPendingFoundingProInvitation: useMyPendingFoundingProInvitationMock,
  useMyFoundingProMembership: useMyFoundingProMembershipMock,
}))
vi.mock('@/modules/founding-pro/hooks/useAcceptFoundingProInvitation', () => ({
  useAcceptFoundingProInvitation: useAcceptFoundingProInvitationMock,
}))

import { FoundingProInvitationPage } from '@/modules/founding-pro/pages/FoundingProInvitationPage'

const invitation = {
  id: 'invitation-1',
  application_id: 'app-1',
  user_id: 'user-1',
  status: 'pending',
  founding_price_cents: 1999,
  currency: 'USD',
  invited_at: '2026-08-01T00:00:00Z',
  invited_by: 'admin-1',
  accepted_at: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(FoundingProInvitationPage)))
}

afterEach(cleanup)

describe('FoundingProInvitationPage', () => {
  let acceptMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    acceptMock = vi.fn()

    useAuthMock.mockReturnValue({ user: { id: 'user-1', email: 'user@example.com' } })
    useMyPendingFoundingProInvitationMock.mockReturnValue({ data: invitation, isLoading: false })
    useMyFoundingProMembershipMock.mockReturnValue({ data: null, isLoading: false })
    useAcceptFoundingProInvitationMock.mockReturnValue({ mutateAsync: acceptMock, isPending: false, isSuccess: false })
  })

  it('shows the read-only founding price from the invitation, with no editable input', () => {
    renderPage()

    expect(screen.getByText(/\$19\.99/)).not.toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('shows a not-found message when there is no pending invitation for this account', () => {
    useMyPendingFoundingProInvitationMock.mockReturnValue({ data: null, isLoading: false })

    renderPage()

    expect(screen.getByText(/No active Founding Pro invitation was found/i)).not.toBeNull()
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull()
  })

  it('shows already-a-member messaging without an accept action when membership already exists', () => {
    useMyFoundingProMembershipMock.mockReturnValue({
      data: { id: 'member-1', user_id: 'user-1', founding_member_number: 7 },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText(/already a Founding Pro member/i)).not.toBeNull()
    expect(screen.getByText(/Founding Member #7/)).not.toBeNull()
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull()
  })

  it('accepting calls the acceptance RPC with no arguments', async () => {
    acceptMock.mockResolvedValueOnce({ memberId: 'member-1', foundingMemberNumber: 7 })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /accept and activate founding pro/i }))

    expect(acceptMock).toHaveBeenCalledWith()
  })

  it('a failed acceptance surfaces the real server error, not a false success', async () => {
    acceptMock.mockRejectedValueOnce(new Error('Founding Pro public capacity is full'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /accept and activate founding pro/i }))

    expect(await screen.findByText('Founding Pro public capacity is full')).not.toBeNull()
  })

  it('after a successful acceptance, shows the member number and a way back into ARRIYIA', () => {
    useAcceptFoundingProInvitationMock.mockReturnValue({ mutateAsync: acceptMock, isPending: false, isSuccess: true })
    useMyFoundingProMembershipMock.mockReturnValue({
      data: { id: 'member-1', user_id: 'user-1', founding_member_number: 7 },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText(/Founding Member #7/)).not.toBeNull()
    expect(screen.getByRole('link', { name: /go to arriyia/i }).getAttribute('href')).toBe('/hub')
  })
})
