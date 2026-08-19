import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// jsdom does not implement <dialog>'s showModal()/close() — ConfirmDialog
// (used here for approve/reject confirmation) calls them imperatively.
// Same polyfill AdminPlansPage.test.ts already establishes.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

/**
 * Founding Pro Programme Phase 3 — the admin operational surface. Mirrors
 * AdminUsersPage.test.ts's mocking convention: hook modules are mocked
 * wholesale, no react-query/Supabase exercised for real. Covers the
 * requirements this page must satisfy: capacity displays from the
 * authoritative RPC, pending applications surface Approve/Reject only
 * where appropriate, approving/rejecting never claims to enroll/assign a
 * slot, and public vs grandfathered members are visibly distinguished.
 */

const {
  useFoundingProCapacityMock,
  useAdminFoundingProApplicationsMock,
  useAdminFoundingProMembersMock,
  useAdminFoundingProEventsMock,
  useAdminApproveFoundingProApplicationMock,
  useAdminRejectFoundingProApplicationMock,
  useAdminInviteFoundingProMemberMock,
  useAdminSendFoundingProInvitationEmailMock,
} = vi.hoisted(() => ({
  useFoundingProCapacityMock: vi.fn(),
  useAdminFoundingProApplicationsMock: vi.fn(),
  useAdminFoundingProMembersMock: vi.fn(),
  useAdminFoundingProEventsMock: vi.fn(),
  useAdminApproveFoundingProApplicationMock: vi.fn(),
  useAdminRejectFoundingProApplicationMock: vi.fn(),
  useAdminInviteFoundingProMemberMock: vi.fn(),
  useAdminSendFoundingProInvitationEmailMock: vi.fn(),
}))

vi.mock('@/modules/founding-pro/hooks/useFoundingProCapacity', () => ({
  useFoundingProCapacity: useFoundingProCapacityMock,
}))

vi.mock('@/modules/admin/hooks/useAdminData', () => ({
  useAdminFoundingProApplications: useAdminFoundingProApplicationsMock,
  useAdminFoundingProMembers: useAdminFoundingProMembersMock,
  useAdminFoundingProEvents: useAdminFoundingProEventsMock,
  useAdminApproveFoundingProApplication: useAdminApproveFoundingProApplicationMock,
  useAdminRejectFoundingProApplication: useAdminRejectFoundingProApplicationMock,
  useAdminInviteFoundingProMember: useAdminInviteFoundingProMemberMock,
  useAdminSendFoundingProInvitationEmail: useAdminSendFoundingProInvitationEmailMock,
}))

import { AdminFoundingProPage } from '@/modules/admin/pages/AdminFoundingProPage'

const pendingApp = {
  id: 'app-1',
  user_id: 'user-1',
  applicant_email: 'pending@example.com',
  applicant_name: 'Pending Applicant',
  status: 'pending',
  submitted_at: '2026-08-01T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  reviewer_email: null,
  review_notes: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  member_id: null,
  member_number: null,
  member_slot_type: null,
  invitation_id: null,
  invitation_status: null,
  invitation_founding_price_cents: null,
  invitation_currency: null,
  invited_at: null,
  invitation_accepted_at: null,
}

const approvedApp = {
  ...pendingApp,
  id: 'app-2',
  applicant_email: 'approved@example.com',
  applicant_name: 'Approved Applicant',
  status: 'approved',
  reviewed_at: '2026-08-02T00:00:00Z',
  reviewed_by: 'admin-1',
  reviewer_email: 'admin@example.com',
}

const invitedApp = {
  ...approvedApp,
  id: 'app-3',
  applicant_email: 'invited@example.com',
  applicant_name: 'Invited Applicant',
  invitation_id: 'invitation-1',
  invitation_status: 'pending',
  invitation_founding_price_cents: 1999,
  invitation_currency: 'USD',
  invited_at: '2026-08-03T00:00:00Z',
}

const publicMember = {
  id: 'member-1',
  user_id: 'user-3',
  applicant_email: 'public@example.com',
  applicant_name: 'Public Member',
  application_id: 'app-3',
  slot_type: 'public',
  founding_member_number: 7,
  founding_price_cents: 1999,
  currency: 'USD',
  founding_started_at: '2026-01-01T00:00:00Z',
  founding_expires_at: '2026-04-01T00:00:00Z',
  transition_status: 'active',
  transitioned_at: null,
  created_at: '2026-01-01T00:00:00Z',
  current_plan_code: 'founding_pro',
}

const grandfatheredMember = {
  ...publicMember,
  id: 'member-2',
  user_id: 'user-4',
  applicant_email: 'grandfathered@example.com',
  applicant_name: 'Grandfathered Member',
  slot_type: 'grandfathered',
  founding_member_number: null,
}

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(AdminFoundingProPage)))
}

afterEach(cleanup)

describe('AdminFoundingProPage', () => {
  let approveMock: ReturnType<typeof vi.fn>
  let rejectMock: ReturnType<typeof vi.fn>
  let inviteMock: ReturnType<typeof vi.fn>
  let sendInviteEmailMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    approveMock = vi.fn()
    rejectMock = vi.fn()
    inviteMock = vi.fn()
    sendInviteEmailMock = vi.fn()

    useFoundingProCapacityMock.mockReturnValue({
      data: { maxPublicSlots: 100, enrolledPublicCount: 37, remainingPublicSlots: 63 },
    })
    useAdminFoundingProApplicationsMock.mockReturnValue({ data: [pendingApp], isLoading: false })
    useAdminFoundingProMembersMock.mockReturnValue({ data: [publicMember, grandfatheredMember], isLoading: false })
    useAdminFoundingProEventsMock.mockReturnValue({ data: [], isLoading: false })
    useAdminApproveFoundingProApplicationMock.mockReturnValue({ mutate: approveMock, isPending: false })
    useAdminRejectFoundingProApplicationMock.mockReturnValue({ mutate: rejectMock, isPending: false })
    useAdminInviteFoundingProMemberMock.mockReturnValue({ mutateAsync: inviteMock, isPending: false })
    useAdminSendFoundingProInvitationEmailMock.mockReturnValue({ mutateAsync: sendInviteEmailMock, isPending: false })
  })

  it('renders the authoritative public capacity figure, not a frontend-derived count', () => {
    renderPage()

    expect(screen.getByText('63 / 100 Founding Pro places remaining')).not.toBeNull()
  })

  it('shows pending applications with Approve/Reject controls', () => {
    renderPage()

    expect(screen.getByText('pending@example.com')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Approve' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Reject' })).not.toBeNull()
  })

  it('does not show Approve/Reject controls for a non-pending application', () => {
    useAdminFoundingProApplicationsMock.mockReturnValue({ data: [approvedApp], isLoading: false })

    renderPage()

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
  })

  it('approving an application confirms first, then calls the approval RPC and states it does not enroll the member', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText(/does not enroll them as a Founding Pro member/i)).not.toBeNull()
    expect(approveMock).not.toHaveBeenCalled()

    const confirmButtons = await screen.findAllByRole('button', { name: 'Approve' })
    fireEvent.click(confirmButtons.at(-1)!)

    expect(approveMock).toHaveBeenCalledWith({ applicationId: 'app-1' }, expect.anything())
  })

  it('rejecting an application confirms first, then calls the rejection RPC', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(rejectMock).not.toHaveBeenCalled()

    const confirmButtons = await screen.findAllByRole('button', { name: 'Reject' })
    fireEvent.click(confirmButtons.at(-1)!)

    expect(rejectMock).toHaveBeenCalledWith({ applicationId: 'app-1' }, expect.anything())
  })

  it('distinguishes Public Founding Members from Grandfathered Members in the registry', () => {
    renderPage()

    expect(screen.getByText('Public Founding Member')).not.toBeNull()
    expect(screen.getByText('Grandfathered')).not.toBeNull()
    expect(screen.getByText('public@example.com')).not.toBeNull()
    expect(screen.getByText('grandfathered@example.com')).not.toBeNull()
  })

  it('total and grandfathered member counts are computed from the admin-authorized member list', () => {
    renderPage()

    const grandfatheredLabel = screen.getByText('Grandfathered members')
    expect(grandfatheredLabel.parentElement?.parentElement?.textContent).toContain('1')

    const totalLabel = screen.getByText('Total Founding Pro members')
    expect(totalLabel.parentElement?.parentElement?.textContent).toContain('2')
  })

  // V1 Founding Pro Expiry — transition_status gained two explicit
  // outcome values (0072_founding_pro_expiry.sql); the registry must show
  // a human-readable label for each, not the raw snake_case value.
  it('shows human-readable transition labels for converted/expired members', () => {
    useAdminFoundingProMembersMock.mockReturnValue({
      data: [
        { ...publicMember, id: 'member-3', applicant_email: 'converted@example.com', transition_status: 'converted_to_pro', transitioned_at: '2026-03-01T00:00:00Z' },
        { ...publicMember, id: 'member-4', applicant_email: 'expired@example.com', transition_status: 'expired_to_free', transitioned_at: '2026-04-05T00:00:00Z' },
      ],
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText('Converted to Pro')).not.toBeNull()
    expect(screen.getByText('Expired to Free')).not.toBeNull()
    expect(screen.queryByText('converted_to_pro')).toBeNull()
    expect(screen.queryByText('expired_to_free')).toBeNull()
  })

  it('shows Send Invitation only for an approved application with no active invitation', () => {
    useAdminFoundingProApplicationsMock.mockReturnValue({ data: [approvedApp], isLoading: false })

    renderPage()

    expect(screen.getByRole('button', { name: 'Send Invitation' })).not.toBeNull()
  })

  it('does not show Send Invitation for a pending application or one with an active invitation', () => {
    useAdminFoundingProApplicationsMock.mockReturnValue({ data: [pendingApp, invitedApp], isLoading: false })

    renderPage()

    expect(screen.queryByRole('button', { name: 'Send Invitation' })).toBeNull()
  })

  it('shows the Invitation Sent lifecycle stage and invited timestamp for an application with a pending invitation', () => {
    useAdminFoundingProApplicationsMock.mockReturnValue({ data: [invitedApp], isLoading: false })

    renderPage()

    expect(screen.getByText('Invitation Sent')).not.toBeNull()
  })

  it('sending an invitation requires a positive price, then calls the invite RPC and the send-email RPC with the created invitation id', async () => {
    useAdminFoundingProApplicationsMock.mockReturnValue({ data: [approvedApp], isLoading: false })
    inviteMock.mockResolvedValueOnce({ id: 'invitation-1' })
    sendInviteEmailMock.mockResolvedValueOnce({ error: null })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Send' }))

    expect(screen.getByText('Enter a founding price greater than zero.')).not.toBeNull()
    expect(inviteMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Founding price'), { target: { value: '19.99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Send' }))

    expect(inviteMock).toHaveBeenCalledWith({ applicationId: 'app-2', foundingPriceCents: 1999, currency: 'USD' })
    expect(await screen.findByText(/invitation email sent to approved@example.com/i)).not.toBeNull()
    expect(sendInviteEmailMock).toHaveBeenCalledWith('invitation-1')
  })
})
