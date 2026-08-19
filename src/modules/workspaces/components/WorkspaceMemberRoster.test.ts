import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * V1 Free Collaboration — WorkspaceMemberRoster no longer tells a Free
 * owner "Inviting teammates requires Pro" (Free now has the collaboration
 * feature itself, 0071_free_access_and_collaboration.sql); what it must
 * now do is show the invite form to any owner whose plan includes
 * collaboration at all, present an advisory active/pending count, and
 * translate the server's controlled P0001 capacity errors
 * (invite_to_workspace's own messages) into a clear, actionable upgrade
 * prompt rather than a raw error string.
 */

const { useAuthMock, navigateMock, useWorkspaceRoleMock, useWorkspaceMembersMock, useWorkspaceInvitationsMock, useHasFeatureMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  navigateMock: vi.fn(),
  useWorkspaceRoleMock: vi.fn(),
  useWorkspaceMembersMock: vi.fn(),
  useWorkspaceInvitationsMock: vi.fn(),
  useHasFeatureMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))
vi.mock('@/modules/workspaces/hooks/useWorkspaceRole', () => ({ useWorkspaceRole: useWorkspaceRoleMock }))
vi.mock('@/modules/workspaces/hooks/useWorkspaceMembers', () => ({ useWorkspaceMembers: useWorkspaceMembersMock }))
vi.mock('@/modules/workspaces/hooks/useWorkspaceInvitations', () => ({ useWorkspaceInvitations: useWorkspaceInvitationsMock }))
vi.mock('@/modules/plans/hooks/useHasFeature', () => ({ useHasFeature: useHasFeatureMock }))

import { WorkspaceMemberRoster } from '@/modules/workspaces/components/WorkspaceMemberRoster'

function renderRoster() {
  return render(createElement(MemoryRouter, null, createElement(WorkspaceMemberRoster, { workspaceId: 'ws-1' })))
}

const activeOwner = { id: 'm-owner', user_id: 'owner-1', role: 'owner', status: 'active', email: 'owner@example.com', display_name: null, created_at: '2026-01-01T00:00:00Z' }
const activeCollaborator = { id: 'm-1', user_id: 'collab-1', role: 'editor', status: 'active', email: 'collab@example.com', display_name: null, created_at: '2026-01-02T00:00:00Z' }

function baseMocks() {
  useAuthMock.mockReturnValue({ user: { id: 'owner-1' } })
  useWorkspaceRoleMock.mockReturnValue({ data: 'owner' })
  useWorkspaceInvitationsMock.mockReturnValue({ data: [], isLoading: false, cancel: { mutate: vi.fn() }, resend: { mutate: vi.fn(), isPending: false } })
}

afterEach(cleanup)

describe('WorkspaceMemberRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the invite form (not a Pro upsell) for a Free owner, since Free now includes collaboration', () => {
    baseMocks()
    useHasFeatureMock.mockReturnValue({ data: true, isLoading: false })
    useWorkspaceMembersMock.mockReturnValue({ data: [activeOwner], isLoading: false, invite: { mutate: vi.fn(), isPending: false, isError: false }, changeRole: { mutate: vi.fn() }, remove: { mutate: vi.fn() } })

    renderRoster()

    expect(screen.getByLabelText('Invite by email')).not.toBeNull()
    expect(screen.queryByText(/Inviting teammates requires Pro/)).toBeNull()
    expect(screen.queryByText(/Collaboration isn't included/)).toBeNull()
  })

  it("shows an upgrade prompt (not the invite form) for a plan without collaboration at all", () => {
    baseMocks()
    useHasFeatureMock.mockReturnValue({ data: false, isLoading: false })
    useWorkspaceMembersMock.mockReturnValue({ data: [activeOwner], isLoading: false, invite: { mutate: vi.fn(), isPending: false, isError: false }, changeRole: { mutate: vi.fn() }, remove: { mutate: vi.fn() } })

    renderRoster()

    expect(screen.getByText("Collaboration isn't included on your plan")).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).not.toBeNull()
    expect(screen.queryByLabelText('Invite by email')).toBeNull()
  })

  it('shows an advisory active/pending collaborator count next to the invite form', () => {
    baseMocks()
    useHasFeatureMock.mockReturnValue({ data: true, isLoading: false })
    useWorkspaceMembersMock.mockReturnValue({
      data: [activeOwner, activeCollaborator],
      isLoading: false,
      invite: { mutate: vi.fn(), isPending: false, isError: false },
      changeRole: { mutate: vi.fn() },
      remove: { mutate: vi.fn() },
    })

    renderRoster()

    expect(screen.getByText('1 active collaborator')).not.toBeNull()
  })

  it('renders a clear upgrade prompt (not a raw error string) when the server rejects an invite for the active-collaborator limit', () => {
    baseMocks()
    useHasFeatureMock.mockReturnValue({ data: true, isLoading: false })
    useWorkspaceMembersMock.mockReturnValue({
      data: [activeOwner, activeCollaborator],
      isLoading: false,
      invite: {
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('This workspace has reached its collaborator limit on your current plan. Upgrade to Pro for expanded collaboration.'),
      },
      changeRole: { mutate: vi.fn() },
      remove: { mutate: vi.fn() },
    })

    renderRoster()

    expect(screen.getByText("You've reached the Free collaboration limit. Upgrade to Pro for expanded collaboration.")).not.toBeNull()
    const upgradeButtons = screen.getAllByRole('button', { name: 'Upgrade to Pro' })
    expect(upgradeButtons.length).toBeGreaterThan(0)
    fireEvent.click(upgradeButtons[0]!)
    expect(navigateMock).toHaveBeenCalledWith('/pricing')
    // The raw server message must not also be shown as a second, redundant line.
    expect(screen.queryByText(/reached its collaborator limit on your current plan/)).toBeNull()
  })

  it('renders the server\'s own pending-invitation message directly, without a redundant generic error line', () => {
    baseMocks()
    useHasFeatureMock.mockReturnValue({ data: true, isLoading: false })
    useWorkspaceMembersMock.mockReturnValue({
      data: [activeOwner],
      isLoading: false,
      invite: {
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('This workspace already has an outstanding invitation. It must be accepted, declined, or cancelled before another can be sent.'),
      },
      changeRole: { mutate: vi.fn() },
      remove: { mutate: vi.fn() },
    })

    renderRoster()

    expect(
      screen.getByText('This workspace already has an outstanding invitation. It must be accepted, declined, or cancelled before another can be sent.'),
    ).not.toBeNull()
  })

  it('renders an unrelated invite failure as a plain error, not the capacity-upgrade treatment', () => {
    baseMocks()
    useHasFeatureMock.mockReturnValue({ data: true, isLoading: false })
    useWorkspaceMembersMock.mockReturnValue({
      data: [activeOwner],
      isLoading: false,
      invite: { mutate: vi.fn(), isPending: false, isError: true, error: new Error('Only a workspace owner can invite members') },
      changeRole: { mutate: vi.fn() },
      remove: { mutate: vi.fn() },
    })

    renderRoster()

    expect(screen.getByText('Only a workspace owner can invite members')).not.toBeNull()
    expect(screen.queryByText(/reached the Free collaboration limit/)).toBeNull()
  })
})
