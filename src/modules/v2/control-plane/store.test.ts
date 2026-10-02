import { describe, expect, it } from 'vitest'
import type { Organization, Project, Workspace } from '../domain/model'
import { V2ControlPlaneStore } from './store'

const organization: Organization = {
  id: 'org-1',
  organizationId: 'org-1',
  name: 'Nolmark',
  slug: 'nolmark',
  status: 'active',
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
}

const workspace: Workspace = {
  id: 'ws-1',
  organizationId: 'org-1',
  name: 'ARRIYIA V2',
  slug: 'arriyia-v2',
  status: 'active',
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
}

const project: Project = {
  id: 'project-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  name: 'Foundation',
  objectiveIds: [],
  status: 'active',
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
}

describe('V2ControlPlaneStore', () => {
  it('enforces parent identity and organization boundaries', () => {
    const store = new V2ControlPlaneStore()

    store.save('organization', organization)
    store.save('workspace', workspace)
    store.save('project', project)

    expect(store.get('project', 'project-1')).toEqual(project)
    expect(store.list('project', {
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    })).toEqual([project])
    expect(store.list('project', {
      organizationId: 'other-org',
      workspaceId: 'ws-1',
    })).toEqual([])
  })

  it('rejects children whose parent is missing', () => {
    const store = new V2ControlPlaneStore()

    expect(() => store.save('workspace', workspace)).toThrow(
      'must exist before its child can be registered',
    )
  })

  it('fails closed when a scoped read crosses workspace boundaries', () => {
    const store = new V2ControlPlaneStore()

    store.save('organization', organization)
    store.save('workspace', workspace)
    store.save('project', project)

    expect(() => store.getScoped('project', 'project-1', {
      organizationId: 'org-1',
      workspaceId: 'ws-2',
    })).toThrow('outside the active organization/workspace scope')
  })

  it('keeps ownership separate from authorization policy', () => {
    const store = new V2ControlPlaneStore()

    expect(store.isOwnedBy(
      { ...project, ownerUserId: 'user-1' },
      { userId: 'user-1' },
    )).toBe(true)

    expect(store.isOwnedBy(
      { ...project, ownerTeamId: 'team-1' },
      { userId: 'user-1' },
    )).toBe(false)
  })
})
