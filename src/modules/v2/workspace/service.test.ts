import { describe, expect, it } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import { createTeamMembership, createWorkspaceMembership, resolveWorkspaceAccess } from './service'

const meta = { createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }

function organization(id: string) {
  return { id, organizationId: id, name: 'Org', slug: id, status: 'active' as const, createdAt: meta.createdAt, updatedAt: meta.updatedAt }
}

function workspace(id: string, organizationId: string) {
  return { id, organizationId, name: 'Workspace', slug: id, status: 'active' as const, createdAt: meta.createdAt, updatedAt: meta.updatedAt }
}

function team(id: string, organizationId: string, workspaceId: string) {
  return { id, organizationId, workspaceId, name: 'Team', status: 'active' as const, createdAt: meta.createdAt, updatedAt: meta.updatedAt }
}

describe('V2 enterprise workspace contracts', () => {
  it('creates workspace membership and resolves active access', () => {
    const store = new V2ControlPlaneStore()
    store.save('organization', organization('org-1'))
    store.save('workspace', workspace('ws-1', 'org-1'))

    const membership = createWorkspaceMembership(store, {
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      roleId: 'role-owner',
    }, meta)

    expect(membership.status).toBe('active')
    expect(resolveWorkspaceAccess(store, 'ws-1', 'user-1', {
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
    }).allowed).toBe(true)
  })

  it('fails closed across organizations and inactive membership', () => {
    const store = new V2ControlPlaneStore()
    store.save('organization', organization('org-1'))
    store.save('organization', organization('org-2'))
    store.save('workspace', workspace('ws-1', 'org-1'))

    createWorkspaceMembership(store, {
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      roleId: 'role-editor',
    }, meta)

    expect(() => resolveWorkspaceAccess(store, 'ws-1', 'user-1', {
      organizationId: 'org-2',
      workspaceId: 'ws-1',
      userId: 'user-1',
    })).toThrow()

    const membership = store.get('workspaceMembership', 'ws-1:user-1')!
    store.replace('workspaceMembership', { ...membership, status: 'suspended' })

    expect(resolveWorkspaceAccess(store, 'ws-1', 'user-1', {
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
    })).toEqual({ allowed: false, reason: 'membership_inactive' })
  })

  it('keeps team membership inside the workspace boundary', () => {
    const store = new V2ControlPlaneStore()
    store.save('organization', organization('org-1'))
    store.save('workspace', workspace('ws-1', 'org-1'))
    store.save('team', team('team-1', 'org-1', 'ws-1'))

    const membership = createTeamMembership(store, {
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      teamId: 'team-1',
      userId: 'user-1',
    }, meta)

    expect(membership.workspaceId).toBe('ws-1')
    expect(store.list('teamMembership', { organizationId: 'org-1', workspaceId: 'ws-1' })).toHaveLength(1)
  })
})
