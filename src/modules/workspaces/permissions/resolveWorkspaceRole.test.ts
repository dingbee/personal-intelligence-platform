import { describe, expect, it, vi } from 'vitest'

interface MembershipResult {
  data: { role: string } | null
  error: Error | null
}
interface WorkspaceResult {
  data: { user_id: string } | null
  error: Error | null
}

const { fromMock, membershipMaybeSingle, workspaceMaybeSingle } = vi.hoisted(() => {
  const membershipMaybeSingle = vi.fn<() => Promise<MembershipResult>>()
  const workspaceMaybeSingle = vi.fn<() => Promise<WorkspaceResult>>()
  const fromMock = vi.fn((table: string) => {
    if (table === 'workspace_members') {
      return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: membershipMaybeSingle }) }) }) }) }
    }
    if (table === 'workspaces') {
      return { select: () => ({ eq: () => ({ maybeSingle: workspaceMaybeSingle }) }) }
    }
    throw new Error(`unexpected table: ${table}`)
  })
  return { fromMock, membershipMaybeSingle, workspaceMaybeSingle }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { resolveWorkspaceRole } from '@/modules/workspaces/permissions/resolveWorkspaceRole'

describe('resolveWorkspaceRole', () => {
  it('resolves owner from an explicit active membership row', async () => {
    membershipMaybeSingle.mockResolvedValueOnce({ data: { role: 'owner' }, error: null })

    const role = await resolveWorkspaceRole('workspace-1', 'user-1')

    expect(role).toBe('owner')
    expect(fromMock).toHaveBeenCalledWith('workspace_members')
  })

  it('resolves editor from an explicit active membership row', async () => {
    membershipMaybeSingle.mockResolvedValueOnce({ data: { role: 'editor' }, error: null })

    const role = await resolveWorkspaceRole('workspace-1', 'user-2')

    expect(role).toBe('editor')
  })

  it('resolves viewer from an explicit active membership row', async () => {
    membershipMaybeSingle.mockResolvedValueOnce({ data: { role: 'viewer' }, error: null })

    const role = await resolveWorkspaceRole('workspace-1', 'user-3')

    expect(role).toBe('viewer')
  })

  it('falls back to the workspace creator as implicit owner when no membership row exists', async () => {
    membershipMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    workspaceMaybeSingle.mockResolvedValueOnce({ data: { user_id: 'user-1' }, error: null })

    const role = await resolveWorkspaceRole('workspace-1', 'user-1')

    expect(role).toBe('owner')
  })

  it('returns null for a non-member with no membership row and no workspace ownership', async () => {
    membershipMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    workspaceMaybeSingle.mockResolvedValueOnce({ data: { user_id: 'someone-else' }, error: null })

    const role = await resolveWorkspaceRole('workspace-1', 'user-4')

    expect(role).toBeNull()
  })

  it('propagates a membership query error', async () => {
    membershipMaybeSingle.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    await expect(resolveWorkspaceRole('workspace-1', 'user-1')).rejects.toThrow('boom')
  })

  it('propagates a workspace lookup error', async () => {
    membershipMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    workspaceMaybeSingle.mockResolvedValueOnce({ data: null, error: new Error('workspace lookup failed') })

    await expect(resolveWorkspaceRole('workspace-1', 'user-1')).rejects.toThrow('workspace lookup failed')
  })
})
