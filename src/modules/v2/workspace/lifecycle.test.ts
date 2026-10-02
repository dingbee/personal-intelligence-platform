import { describe, expect, it } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import {
  createObjective,
  createProject,
  createWorkspace,
  setObjectiveStatus,
  setProjectStatus,
  setWorkspaceStatus,
  updateObjective,
  updateProject,
  updateWorkspace,
} from './lifecycle'
import {
  createWorkspaceMembership,
  setWorkspaceMembershipStatus,
  updateWorkspaceMembership,
} from './service'

const meta = {
  createdAt: '2026-10-02T00:00:00Z',
  updatedAt: '2026-10-02T00:01:00Z',
}

function base() {
  const store = new V2ControlPlaneStore()
  store.save('organization', {
    id: 'org-1',
    organizationId: 'org-1',
    name: 'Org',
    slug: 'org',
    status: 'active',
    createdAt: meta.createdAt,
    updatedAt: meta.createdAt,
  })
  store.save('user', {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'user@example.com',
    displayName: 'User',
    status: 'active',
    createdAt: meta.createdAt,
    updatedAt: meta.createdAt,
  })
  store.save('role', {
    id: 'role-owner',
    organizationId: 'org-1',
    name: 'Owner',
    permissions: [],
    status: 'active',
    createdAt: meta.createdAt,
    updatedAt: meta.createdAt,
  })
  return store
}

describe('V2 workspace lifecycle', () => {
  it('creates, updates, pauses, and restores a workspace', () => {
    const store = base()
    createWorkspace(store, {
      id: 'ws-1',
      organizationId: 'org-1',
      name: 'Operations',
      slug: 'operations',
    }, meta)

    expect(updateWorkspace(store, 'ws-1', { name: 'Operations HQ' }, meta).name).toBe('Operations HQ')
    expect(setWorkspaceStatus(store, 'ws-1', 'archived', meta).status).toBe('archived')
    expect(setWorkspaceStatus(store, 'ws-1', 'active', meta).status).toBe('active')
  })

  it('supports membership invitation, role update, suspension, and reactivation', () => {
    const store = base()
    createWorkspace(store, {
      id: 'ws-1',
      organizationId: 'org-1',
      name: 'Operations',
      slug: 'operations',
    }, meta)

    const membership = createWorkspaceMembership(store, {
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      roleId: 'role-owner',
      status: 'invited',
    }, meta)

    expect(membership.status).toBe('invited')
    expect(updateWorkspaceMembership(store, membership.id, { status: 'active' }, meta).status).toBe('active')
    expect(setWorkspaceMembershipStatus(store, membership.id, 'suspended', meta).status).toBe('suspended')
    expect(setWorkspaceMembershipStatus(store, membership.id, 'active', meta).status).toBe('active')
  })

  it('maintains project and objective lifecycle state and editable fields', () => {
    const store = base()
    createWorkspace(store, {
      id: 'ws-1',
      organizationId: 'org-1',
      name: 'Operations',
      slug: 'operations',
    }, meta)
    createProject(store, {
      id: 'project-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Growth',
    }, meta)
    createObjective(store, {
      id: 'objective-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      projectId: 'project-1',
      title: 'Increase qualified demand',
    }, meta)

    expect(updateProject(store, 'project-1', { name: 'Growth Engine' }, meta).name).toBe('Growth Engine')
    expect(setProjectStatus(store, 'project-1', 'active', meta).status).toBe('active')
    expect(updateObjective(store, 'objective-1', {
      title: 'Increase qualified pipeline',
      target: { monthly: 100 },
    }, meta).target).toEqual({ monthly: 100 })
    expect(setObjectiveStatus(store, 'objective-1', 'active', meta).status).toBe('active')
  })
})
