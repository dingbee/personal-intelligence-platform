import { describe, expect, it, vi } from 'vitest'

interface FakeMembershipRow {
  id: string
  workspace_id: string
  user_id: string
  role: string
  status: string
  invited_by: string | null
  created_at: string
  updated_at: string
}

interface FakeInvitationRow {
  id: string
  workspace_id: string
  email: string
  role: string
  status: string
  invited_by: string | null
  created_at: string
  updated_at: string
  expires_at: string
  accepted_at: string | null
  accepted_by: string | null
}

const {
  insertMock,
  singleMock,
  updateMock,
  updateEqMock,
  updateSingleMock,
  topSelectMock,
  topEqMock,
  orderMock,
  invitationsSelectMock,
  invitationsEqWorkspaceMock,
  invitationsEqStatusMock,
  invitationsOrderMock,
  rpcMock,
  fromMock,
  functionsInvokeMock,
} = vi.hoisted(() => {
  const singleMock = vi.fn<() => Promise<{ data: FakeMembershipRow | null; error: Error | null }>>()
  const insertSelectMock = vi.fn(() => ({ single: singleMock }))
  const insertMock = vi.fn(() => ({ select: insertSelectMock }))

  // Shared by workspace_members' updateWorkspaceMemberRole/removeWorkspaceMember
  // and workspace_invitations' cancelWorkspaceInvitation — same call shape,
  // different row types, so the mock accepts either.
  const updateSingleMock = vi.fn<() => Promise<{ data: FakeMembershipRow | FakeInvitationRow | null; error: Error | null }>>()
  const updateSelectMock = vi.fn(() => ({ single: updateSingleMock }))
  const updateEqMock = vi.fn(() => ({ select: updateSelectMock }))
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))

  // workspace_members' own select chain — used by listMyPendingInvitations.
  const orderMock = vi.fn<() => Promise<{ data: unknown[] | null; error: Error | null }>>()
  const topEqMock = vi.fn(() => ({ order: orderMock }))
  const topSelectMock = vi.fn(() => ({ eq: topEqMock }))

  // workspace_invitations' own select chain — one extra .eq() (workspace_id,
  // then status) versus workspace_members', so it needs its own mock shape
  // rather than reusing topSelectMock.
  const invitationsOrderMock = vi.fn<() => Promise<{ data: FakeInvitationRow[] | null; error: Error | null }>>()
  const invitationsEqStatusMock = vi.fn(() => ({ order: invitationsOrderMock }))
  const invitationsEqWorkspaceMock = vi.fn(() => ({ eq: invitationsEqStatusMock }))
  const invitationsSelectMock = vi.fn(() => ({ eq: invitationsEqWorkspaceMock }))

  const rpcMock = vi.fn<() => Promise<{ data: unknown; error: Error | null }>>()
  const functionsInvokeMock = vi.fn<() => Promise<{ data: unknown; error: Error | null }>>()

  const fromMock = vi.fn((table: string) => {
    if (table === 'workspace_invitations') {
      // cancelWorkspaceInvitation's .update().eq().select().single() shape
      // is identical to updateWorkspaceMemberRole's, so it reuses the same
      // updateMock/updateEqMock/updateSingleMock triple — the mock doesn't
      // care which table it's called for, only the call shape.
      return { select: invitationsSelectMock, update: updateMock }
    }
    return { insert: insertMock, update: updateMock, select: topSelectMock }
  })

  return {
    insertMock,
    singleMock,
    updateMock,
    updateEqMock,
    updateSingleMock,
    topSelectMock,
    topEqMock,
    orderMock,
    invitationsSelectMock,
    invitationsEqWorkspaceMock,
    invitationsEqStatusMock,
    invitationsOrderMock,
    rpcMock,
    fromMock,
    functionsInvokeMock,
  }
})

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock, functions: { invoke: functionsInvokeMock } },
}))

import {
  cancelWorkspaceInvitation,
  createWorkspaceMembership,
  inviteToWorkspace,
  listMyPendingInvitations,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  removeWorkspaceMember,
  respondToWorkspaceInvitation,
  sendInvitationEmailForResult,
  sendWorkspaceInvitationEmail,
  updateWorkspaceMemberRole,
} from '@/modules/workspaces/api/workspaceMembers'

function fakeRow(overrides: Partial<FakeMembershipRow>): FakeMembershipRow {
  return {
    id: 'member-1',
    workspace_id: 'workspace-1',
    user_id: 'user-1',
    role: 'owner',
    status: 'active',
    invited_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakeInvitationRow(overrides: Partial<FakeInvitationRow>): FakeInvitationRow {
  return {
    id: 'invitation-1',
    workspace_id: 'workspace-1',
    email: 'invitee@example.com',
    role: 'editor',
    status: 'pending',
    invited_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    expires_at: '2026-01-31T00:00:00.000Z',
    accepted_at: null,
    accepted_by: null,
    ...overrides,
  }
}

describe('createWorkspaceMembership', () => {
  it('creates an owner membership', async () => {
    singleMock.mockResolvedValueOnce({ data: fakeRow({ role: 'owner' }), error: null })

    const result = await createWorkspaceMembership({ workspaceId: 'workspace-1', userId: 'user-1', role: 'owner' })

    expect(fromMock).toHaveBeenCalledWith('workspace_members')
    expect(insertMock).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      user_id: 'user-1',
      role: 'owner',
      status: 'active',
      invited_by: null,
    })
    expect(result.role).toBe('owner')
  })

  it('creates an editor membership', async () => {
    singleMock.mockResolvedValueOnce({ data: fakeRow({ id: 'member-2', user_id: 'user-2', role: 'editor' }), error: null })

    const result = await createWorkspaceMembership({ workspaceId: 'workspace-1', userId: 'user-2', role: 'editor' })

    expect(insertMock).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      user_id: 'user-2',
      role: 'editor',
      status: 'active',
      invited_by: null,
    })
    expect(result.role).toBe('editor')
  })

  it('creates a viewer membership with an explicit invitedBy', async () => {
    singleMock.mockResolvedValueOnce({
      data: fakeRow({ id: 'member-3', user_id: 'user-3', role: 'viewer', invited_by: 'user-1' }),
      error: null,
    })

    const result = await createWorkspaceMembership({
      workspaceId: 'workspace-1',
      userId: 'user-3',
      role: 'viewer',
      invitedBy: 'user-1',
    })

    expect(insertMock).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      user_id: 'user-3',
      role: 'viewer',
      status: 'active',
      invited_by: 'user-1',
    })
    expect(result.role).toBe('viewer')
  })

  it('rejects a duplicate membership', async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error('duplicate key value violates unique constraint "workspace_members_workspace_id_user_id_key"'), {
        code: '23505',
      }),
    })

    await expect(
      createWorkspaceMembership({ workspaceId: 'workspace-1', userId: 'user-1', role: 'editor' }),
    ).rejects.toThrow(/duplicate key/)
  })
})

describe('inviteToWorkspace', () => {
  it('calls the invite_to_workspace RPC with the right arguments for a known account', async () => {
    rpcMock.mockResolvedValueOnce({ data: { outcome: 'member_invited', membership_id: 'member-1' }, error: null })

    const result = await inviteToWorkspace({ workspaceId: 'workspace-1', email: 'teammate@example.com', role: 'editor' })

    expect(rpcMock).toHaveBeenCalledWith('invite_to_workspace', {
      target_workspace_id: 'workspace-1',
      invitee_email: 'teammate@example.com',
      invitee_role: 'editor',
    })
    expect(result).toEqual({ outcome: 'member_invited', membership_id: 'member-1' })
  })

  it('returns an invitation_created outcome for an email with no account yet', async () => {
    rpcMock.mockResolvedValueOnce({ data: { outcome: 'invitation_created', invitation_id: 'invitation-1' }, error: null })

    const result = await inviteToWorkspace({ workspaceId: 'workspace-1', email: 'unknown@example.com', role: 'viewer' })

    expect(result).toEqual({ outcome: 'invitation_created', invitation_id: 'invitation-1' })
  })

  it('trims and lower-cases the email before calling the RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: { outcome: 'invitation_created', invitation_id: 'invitation-2' }, error: null })

    await inviteToWorkspace({ workspaceId: 'workspace-1', email: '  Teammate@Example.com  ', role: 'editor' })

    expect(rpcMock).toHaveBeenCalledWith('invite_to_workspace', {
      target_workspace_id: 'workspace-1',
      invitee_email: 'teammate@example.com',
      invitee_role: 'editor',
    })
  })

  it('propagates the RPC error for a non-owner caller', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Only a workspace owner can invite members') })

    await expect(
      inviteToWorkspace({ workspaceId: 'workspace-1', email: 'teammate@example.com', role: 'viewer' }),
    ).rejects.toThrow(/Only a workspace owner/)
  })

  it('propagates the RPC error for an already-active member', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('That person is already a member of this workspace') })

    await expect(
      inviteToWorkspace({ workspaceId: 'workspace-1', email: 'existing@example.com', role: 'viewer' }),
    ).rejects.toThrow(/already a member/)
  })
})

describe('respondToWorkspaceInvitation', () => {
  it('accepts an invitation', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeRow({ status: 'active' }), error: null })

    const result = await respondToWorkspaceInvitation('member-1', true)

    expect(rpcMock).toHaveBeenCalledWith('respond_to_workspace_invitation', {
      target_membership_id: 'member-1',
      accept: true,
    })
    expect(result.status).toBe('active')
  })

  it('declines an invitation', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeRow({ status: 'pending' }), error: null })

    await respondToWorkspaceInvitation('member-1', false)

    expect(rpcMock).toHaveBeenCalledWith('respond_to_workspace_invitation', {
      target_membership_id: 'member-1',
      accept: false,
    })
  })

  it('propagates an error for an already-responded-to invitation', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Invitation not found or already responded to') })

    await expect(respondToWorkspaceInvitation('member-1', true)).rejects.toThrow(/already responded/)
  })
})

describe('listWorkspaceMembers', () => {
  it('calls the list_workspace_members RPC and returns the roster', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        { ...fakeRow({ role: 'owner' }), email: 'owner@example.com', display_name: null },
        { ...fakeRow({ id: 'member-2', role: 'editor' }), email: 'editor@example.com', display_name: 'Editor' },
      ],
      error: null,
    })

    const result = await listWorkspaceMembers('workspace-1')

    expect(rpcMock).toHaveBeenCalledWith('list_workspace_members', { target_workspace_id: 'workspace-1' })
    expect(result).toHaveLength(2)
    expect(result[0]!.email).toBe('owner@example.com')
  })

  it('propagates an error for a non-member caller', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not a member of this workspace') })

    await expect(listWorkspaceMembers('workspace-1')).rejects.toThrow(/Not a member/)
  })
})

describe('updateWorkspaceMemberRole', () => {
  it('updates a member role', async () => {
    updateSingleMock.mockResolvedValueOnce({ data: fakeRow({ role: 'viewer' }), error: null })

    const result = await updateWorkspaceMemberRole('member-1', 'viewer')

    expect(updateMock).toHaveBeenCalledWith({ role: 'viewer' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'member-1')
    expect(result.role).toBe('viewer')
  })
})

describe('removeWorkspaceMember', () => {
  it('soft-removes a member by setting status to removed', async () => {
    updateSingleMock.mockResolvedValueOnce({ data: fakeRow({ status: 'removed' }), error: null })

    const result = await removeWorkspaceMember('member-1')

    expect(updateMock).toHaveBeenCalledWith({ status: 'removed' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'member-1')
    expect(result.status).toBe('removed')
  })
})

describe('listMyPendingInvitations', () => {
  it('lists the current user\'s pending invitations with the workspace name', async () => {
    orderMock.mockResolvedValueOnce({
      data: [{ ...fakeRow({ status: 'pending' }), workspaces: { name: 'Shared workspace' } }],
      error: null,
    })

    const result = await listMyPendingInvitations()

    expect(topSelectMock).toHaveBeenCalledWith('*, workspaces(name)')
    expect(topEqMock).toHaveBeenCalledWith('status', 'pending')
    expect(result).toHaveLength(1)
    expect(result[0]!.workspace).toEqual({ name: 'Shared workspace' })
  })
})

describe('listWorkspaceInvitations', () => {
  it('lists a workspace\'s pending email-based invitations', async () => {
    invitationsOrderMock.mockResolvedValueOnce({
      data: [fakeInvitationRow({}), fakeInvitationRow({ id: 'invitation-2', email: 'second@example.com' })],
      error: null,
    })

    const result = await listWorkspaceInvitations('workspace-1')

    expect(fromMock).toHaveBeenCalledWith('workspace_invitations')
    expect(invitationsSelectMock).toHaveBeenCalledWith('*')
    expect(invitationsEqWorkspaceMock).toHaveBeenCalledWith('workspace_id', 'workspace-1')
    expect(invitationsEqStatusMock).toHaveBeenCalledWith('status', 'pending')
    expect(result).toHaveLength(2)
    expect(result[1]!.email).toBe('second@example.com')
  })

  it('propagates an error', async () => {
    invitationsOrderMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    await expect(listWorkspaceInvitations('workspace-1')).rejects.toThrow(/boom/)
  })
})

describe('cancelWorkspaceInvitation', () => {
  it('sets status to cancelled', async () => {
    updateSingleMock.mockResolvedValueOnce({ data: fakeInvitationRow({ status: 'cancelled' }), error: null })

    const result = await cancelWorkspaceInvitation('invitation-1')

    expect(fromMock).toHaveBeenCalledWith('workspace_invitations')
    expect(updateMock).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'invitation-1')
    expect(result.status).toBe('cancelled')
  })

  it('propagates an error for a non-owner caller (RLS denies the update)', async () => {
    updateSingleMock.mockResolvedValueOnce({ data: null, error: new Error('No rows returned') })

    await expect(cancelWorkspaceInvitation('invitation-1')).rejects.toThrow(/No rows returned/)
  })
})

describe('sendWorkspaceInvitationEmail', () => {
  it('invokes the edge function with the given params and returns no error on success', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: { sent: true }, error: null })

    const result = await sendWorkspaceInvitationEmail({ workspaceId: 'workspace-1', kind: 'invitation', id: 'invitation-1' })

    expect(functionsInvokeMock).toHaveBeenCalledWith('send-workspace-invitation', {
      body: { workspaceId: 'workspace-1', kind: 'invitation', id: 'invitation-1' },
    })
    expect(result).toEqual({ error: null })
  })

  it('returns the error message rather than throwing when the provider rejects the send', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('Email provider error: 502 upstream failure') })

    const result = await sendWorkspaceInvitationEmail({ workspaceId: 'workspace-1', kind: 'invitation', id: 'invitation-1' })

    expect(result).toEqual({ error: 'Email provider error: 502 upstream failure' })
  })

  it('surfaces a 403 from a non-owner caller as an error, not a throw', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('Only a workspace owner can send invitation emails') })

    const result = await sendWorkspaceInvitationEmail({ workspaceId: 'workspace-1', kind: 'membership', id: 'member-1' })

    expect(result.error).toMatch(/Only a workspace owner/)
  })
})

describe('sendInvitationEmailForResult', () => {
  it('maps an invitation_created outcome to the invitation kind/id', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: { sent: true }, error: null })

    const error = await sendInvitationEmailForResult('workspace-1', { outcome: 'invitation_created', invitation_id: 'invitation-9' })

    expect(functionsInvokeMock).toHaveBeenCalledWith('send-workspace-invitation', {
      body: { workspaceId: 'workspace-1', kind: 'invitation', id: 'invitation-9' },
    })
    expect(error).toBeNull()
  })

  it('maps a member_invited outcome to the membership kind/id', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: { sent: true }, error: null })

    const error = await sendInvitationEmailForResult('workspace-1', { outcome: 'member_invited', membership_id: 'member-9' })

    expect(functionsInvokeMock).toHaveBeenCalledWith('send-workspace-invitation', {
      body: { workspaceId: 'workspace-1', kind: 'membership', id: 'member-9' },
    })
    expect(error).toBeNull()
  })

  it('returns the delivery error string for the caller to surface, without throwing', async () => {
    functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('RESEND_API_KEY is not configured') })

    const error = await sendInvitationEmailForResult('workspace-1', { outcome: 'invitation_created', invitation_id: 'invitation-9' })

    expect(error).toBe('RESEND_API_KEY is not configured')
  })
})
