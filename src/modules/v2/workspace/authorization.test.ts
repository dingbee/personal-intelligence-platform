import { describe, expect, it } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import { authorize, govern } from './authorization'
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


describe('V2 governance and security', () => {
  const governedBase = () => {
    const store = base()
    store.save('permission', {
      id: 'perm-action-execute',
      organizationId: 'org-1',
      key: 'action.execute',
      status: 'active',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    })
    store.replace('role', {
      ...store.get('role', 'role-editor')!,
      permissions: ['perm-project-read', 'perm-action-execute'],
    })
    return store
  }

  const governanceRequest = (overrides: Partial<Parameters<typeof govern>[1]> = {}) => ({
    userId: 'user-1',
    permission: 'action.execute',
    resource: {
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      resourceType: 'action',
      action: 'execute',
    },
    context: { organizationId: 'org-1', workspaceId: 'ws-1', userId: 'user-1' },
    requestedAutonomy: 'manual' as const,
    ...overrides,
  })

  it('derives the autonomy ceiling from policy, not caller input', () => {
    const store = governedBase()
    store.save('policy', {
      id: 'policy-bounded',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Bounded actions',
      effect: 'allow',
      maximumAutonomy: 'bounded',
      rules: [{ resource: 'action', action: 'execute' }],
      status: 'active',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    })

    const decision = govern(store, governanceRequest({
      requestedAutonomy: 'autonomous',
    }))
    expect(decision).toMatchObject({ allowed: false, decision: 'denied', reason: 'autonomy_exceeded' })
  })

  it('fails closed when an elevated autonomy request has no governing policy ceiling', () => {
    const store = governedBase()
    const decision = govern(store, governanceRequest({
      requestedAutonomy: 'assisted',
    }))
    expect(decision).toMatchObject({ allowed: false, decision: 'denied', reason: 'autonomy_exceeded' })
  })

  it('gives explicit deny policy precedence over an allow policy', () => {
    const store = governedBase()
    store.save('policy', {
      id: 'policy-allow',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Allow action',
      effect: 'allow',
      maximumAutonomy: 'bounded',
      rules: [{ resource: 'action', action: 'execute' }],
      status: 'active',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    })
    store.save('policy', {
      id: 'policy-deny',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Deny action',
      effect: 'deny',
      rules: [{ resource: 'action', action: 'execute' }],
      status: 'active',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    })

    const decision = govern(store, governanceRequest())
    expect(decision).toMatchObject({ allowed: false, decision: 'denied', reason: 'policy_denied' })
    expect(decision.policyIds).toContain('policy-deny')
  })

  it('does not treat an approval ID as approval until the scoped approval is granted', () => {
    const store = governedBase()
    store.save('policy', {
      id: 'policy-approved-action',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Approved actions',
      effect: 'allow',
      maximumAutonomy: 'bounded',
      rules: [{ resource: 'action', action: 'execute' }],
      status: 'active',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    })
    store.save('approval', {
      id: 'approval-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      subjectType: 'action',
      subjectId: 'action-1',
      requestedBy: 'user-1',
      status: 'active',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    })

    const pending = govern(store, governanceRequest({
      requiresApproval: true,
      approvalId: 'approval-1',
      requestedAutonomy: 'bounded',
    }))
    expect(pending).toMatchObject({
      allowed: false,
      decision: 'approval_required',
      reason: 'approval_not_granted',
    })

    store.replace('approval', {
      ...store.get('approval', 'approval-1')!,
      decision: 'approved',
      decidedBy: 'user-1',
      decidedAt: '2026-10-03T03:00:00Z',
    })

    const approved = govern(store, governanceRequest({
      requiresApproval: true,
      approvalId: 'approval-1',
      requestedAutonomy: 'bounded',
    }))
    expect(approved).toMatchObject({ allowed: true, decision: 'allowed' })
  })

  it('fails closed when the resource organization differs from the governance context', () => {
    const store = governedBase()
    const decision = govern(store, governanceRequest({
      resource: {
        organizationId: 'org-2',
        workspaceId: 'ws-1',
        resourceType: 'action',
        action: 'execute',
      },
    }))
    expect(decision).toMatchObject({ allowed: false, reason: 'tenant_scope_violation' })
  })
})
