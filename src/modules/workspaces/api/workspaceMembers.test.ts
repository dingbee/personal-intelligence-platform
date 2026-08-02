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

const {
  insertMock,
  singleMock,
  updateMock,
  updateEqMock,
  updateSingleMock,
  topSelectMock,
  topEqMock,
  orderMock,
  rpcMock,
  fromMock,
} = vi.hoisted(() => {
  const singleMock = vi.fn<() => Promise<{ data: FakeMembershipRow | null; error: Error | null }>>()
  const insertSelectMock = vi.fn(() => ({ single: singleMock }))
  const insertMock = vi.fn(() => ({ select: insertSelectMock }))

  const updateSingleMock = vi.fn<() => Promise<{ data: FakeMembershipRow | null; error: Error | null }>>()
  const updateSelectMock = vi.fn(() => ({ single: updateSingleMock }))
  const updateEqMock = vi.fn(() => ({ select: updateSelectMock }))
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))

  const orderMock = vi.fn<() => Promise<{ data: unknown[] | null; error: Error | null }>>()
  const topEqMock = vi.fn(() => ({ order: orderMock }))
  const topSelectMock = vi.fn(() => ({ eq: topEqMock }))

  const rpcMock = vi.fn<() => Promise<{ data: unknown; error: Error | null }>>()

  const fromMock = vi.fn(() => ({ insert: insertMock, update: updateMock, select: topSelectMock }))

  return {
    insertMock,
    singleMock,
    updateMock,
    updateEqMock,
    updateSingleMock,
    topSelectMock,
    topEqMock,
    orderMock,
    rpcMock,
    fromMock,
  }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }))

import {
  createWorkspaceMembership,
  inviteToWorkspace,
  listMyPendingInvitations,
  listWorkspaceMembers,
  removeWorkspaceMember,
  respondToWorkspaceInvitation,
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
  it('calls the invite_to_workspace RPC with the right arguments', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeRow({ role: 'editor', status: 'pending' }), error: null })

    const result = await inviteToWorkspace({ workspaceId: 'workspace-1', email: 'teammate@example.com', role: 'editor' })

    expect(rpcMock).toHaveBeenCalledWith('invite_to_workspace', {
      target_workspace_id: 'workspace-1',
      invitee_email: 'teammate@example.com',
      invitee_role: 'editor',
    })
    expect(result.status).toBe('pending')
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
