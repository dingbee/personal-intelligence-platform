import { describe, expect, it } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import { authorize } from './authorization'
import { createObjective, createProject } from './lifecycle'
import { createWorkspaceMembership } from './service'

const meta = { createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }

const base = () => {
  const store = new V2ControlPlaneStore()
  store.save('organization', { id: 'org-1', organizationId: 'org-1', name: 'Org', slug: 'org', status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  store.save('workspace', { id: 'ws-1', organizationId: 'org-1', name: 'Workspace', slug: 'workspace', status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  store.save('user', { id: 'user-1', organizationId: 'org-1', email: 'user@example.com', displayName: 'User', status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  store.save('permission', { id: 'perm-project-read', organizationId: 'org-1', key: 'project.read', status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  store.save('role', { id: 'role-editor', organizationId: 'org-1', name: 'Editor', permissions: ['perm-project-read'], status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  createWorkspaceMembership(store, { organizationId: 'org-1', workspaceId: 'ws-1', userId: 'user-1', roleId: 'role-editor' }, meta)
  return store
}

describe('V2 workspace authorization and lifecycle', () => {
  it('authorizes a permission through the workspace role binding', () => {
    const store = base()
    expect(authorize(store, {
      userId: 'user-1',
      permission: 'project.read',
      context: { organizationId: 'org-1', workspaceId: 'ws-1', userId: 'user-1' },
    })).toEqual({ allowed: true, roleId: 'role-editor', permission: 'project.read' })
  })

  it('denies permissions not bound to the member role', () => {
    const store = base()
    expect(authorize(store, {
      userId: 'user-1',
      permission: 'project.delete',
      context: { organizationId: 'org-1', workspaceId: 'ws-1', userId: 'user-1' },
    })).toEqual({ allowed: false, reason: 'permission_missing' })
  })

  it('creates projects and links objectives into the project lifecycle', () => {
    const store = base()
    createProject(store, { id: 'project-1', organizationId: 'org-1', workspaceId: 'ws-1', name: 'Growth' }, meta)
    createObjective(store, {
      id: 'objective-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      projectId: 'project-1',
      title: 'Increase qualified demand',
    }, meta)

    expect(store.get('project', 'project-1')?.objectiveIds).toEqual(['objective-1'])
  })

  it('rejects an objective whose project belongs to another workspace', () => {
    const store = base()
    store.save('workspace', { id: 'ws-2', organizationId: 'org-1', name: 'Other', slug: 'other', status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
    createProject(store, { id: 'project-2', organizationId: 'org-1', workspaceId: 'ws-2', name: 'Other Project' }, meta)

    expect(() => createObjective(store, {
      id: 'objective-2',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      projectId: 'project-2',
      title: 'Invalid',
    }, meta)).toThrow()
  })
})
