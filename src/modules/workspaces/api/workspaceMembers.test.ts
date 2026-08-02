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

const { insertMock, singleMock, fromMock } = vi.hoisted(() => {
  const singleMock = vi.fn<() => Promise<{ data: FakeMembershipRow | null; error: Error | null }>>()
  const selectMock = vi.fn(() => ({ single: singleMock }))
  const insertMock = vi.fn(() => ({ select: selectMock }))
  const fromMock = vi.fn(() => ({ insert: insertMock }))
  return { insertMock, singleMock, fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { createWorkspaceMembership } from '@/modules/workspaces/api/workspaceMembers'

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
