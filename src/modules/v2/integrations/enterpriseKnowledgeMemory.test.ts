import { describe, expect, it, vi } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import { createWorkspaceMembership } from '../workspace/service'
import {
  composeEnterpriseKnowledgeContext,
  resolveAuthorizedEnterpriseKnowledgeContext,
  type EnterpriseKnowledgeMemoryItem,
} from './enterpriseKnowledgeMemory'

const now = '2026-10-10T12:00:00.000Z'
const meta = { createdAt: now, updatedAt: now }

function memory(overrides: Partial<EnterpriseKnowledgeMemoryItem> = {}): EnterpriseKnowledgeMemoryItem {
  return {
    id: 'memory-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    ownerUserId: null,
    visibility: 'workspace',
    kind: 'decision',
    status: 'active',
    content: 'Approved supplier terms: net 30.',
    sensitivity: 'internal',
    confidence: 0.9,
    lastReinforcedAt: now,
    updatedAt: now,
    expiresAt: null,
    evidence: [{
      sourceId: 'source-1',
      sourceRecordId: 'record-1',
      sourceSystem: 'finance-system',
      observedAt: now,
      locator: 'invoice/record-1',
    }],
    ...overrides,
  }
}

function storeWithPermission(permissionKey = 'enterprise_knowledge.read') {
  const store = new V2ControlPlaneStore()
  store.save('organization', { id: 'org-1', organizationId: 'org-1', name: 'Org', slug: 'org', status: 'active', createdAt: now, updatedAt: now })
  store.save('workspace', { id: 'ws-1', organizationId: 'org-1', name: 'Space', slug: 'space', status: 'active', createdAt: now, updatedAt: now })
  store.save('user', { id: 'user-1', organizationId: 'org-1', email: 'user@example.com', displayName: 'User', status: 'active', createdAt: now, updatedAt: now })
  store.save('permission', { id: 'perm-1', organizationId: 'org-1', key: permissionKey, status: 'active', createdAt: now, updatedAt: now })
  store.save('role', { id: 'role-1', organizationId: 'org-1', name: 'Reader', permissions: ['perm-1'], status: 'active', createdAt: now, updatedAt: now })
  createWorkspaceMembership(store, { organizationId: 'org-1', workspaceId: 'ws-1', userId: 'user-1', roleId: 'role-1' }, meta)
  return store
}

const context = { organizationId: 'org-1', workspaceId: 'ws-1', userId: 'user-1' }
const options = { now, maxItems: 10, maxCharacters: 500, maximumSensitivity: 'confidential' as const }

describe('EIF-04 enterprise knowledge/memory context', () => {
  it('preserves scoped evidence and returns a deterministic context packet', () => {
    const result = composeEnterpriseKnowledgeContext([memory()], context, options)
    expect(result).toMatchObject({
      status: 'ready',
      scope: context,
      characterCount: memory().content.length,
      items: [{ id: 'memory-1', content: memory().content, evidence: [{ sourceId: 'source-1', sourceRecordId: 'record-1' }] }],
    })
  })

  it('fails closed on cross-workspace and duplicate canonical memory IDs', () => {
    expect(composeEnterpriseKnowledgeContext([memory({ workspaceId: 'ws-other' })], context, options))
      .toMatchObject({ status: 'scope_violation' })
    expect(composeEnterpriseKnowledgeContext([memory(), memory()], context, options))
      .toMatchObject({ status: 'scope_violation' })
  })

  it('excludes expired, inactive, over-classified, and another user private memories', () => {
    const result = composeEnterpriseKnowledgeContext([
      memory({ id: 'expired', expiresAt: '2026-10-10T11:59:59.000Z' }),
      memory({ id: 'archived', status: 'archived' }),
      memory({ id: 'restricted', sensitivity: 'restricted' }),
      memory({ id: 'private', visibility: 'owner_only', ownerUserId: 'user-2' }),
      memory({ id: 'allowed' }),
    ], context, options)
    expect(result).toMatchObject({
      status: 'ready',
      items: [{ id: 'allowed' }],
      omitted: { expired: 1, inactive: 1, sensitivity: 1, private: 1 },
    })
  })

  it('rejects malformed evidence and future timestamps instead of fabricating provenance', () => {
    const result = composeEnterpriseKnowledgeContext([
      memory({ id: 'bad-evidence', evidence: [] }),
      memory({ id: 'future', evidence: [{ sourceId: 's', sourceRecordId: 'r', sourceSystem: 'sys', observedAt: '2026-10-11T00:00:00.000Z' }] }),
    ], context, options)
    expect(result).toMatchObject({ status: 'ready', items: [], omitted: { invalid: 2 } })
  })

  it('ranks reinforced memory using existing read-time confidence decay and respects context budgets', () => {
    const old = memory({ id: 'old', confidence: 0.9, lastReinforcedAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' })
    const fresh = memory({ id: 'fresh', confidence: 0.8, lastReinforcedAt: now, content: 'Fresh decision.' })
    const ranked = composeEnterpriseKnowledgeContext([old, fresh], context, options)
    expect(ranked.status).toBe('ready')
    if (ranked.status === 'ready') expect(ranked.items[0].id).toBe('fresh')

    const budgeted = composeEnterpriseKnowledgeContext([memory(), memory({ id: 'second', content: 'Another context item.' })], context, { ...options, maxItems: 1, maxCharacters: 500 })
    expect(budgeted).toMatchObject({ status: 'ready', items: [{ id: 'memory-1' }], omitted: { budget: 1 } })
  })

  it('does not load memory candidates before governance authorizes the read', async () => {
    const loader = vi.fn(async () => [memory()])
    const denied = await resolveAuthorizedEnterpriseKnowledgeContext({
      store: new V2ControlPlaneStore(),
      userId: 'user-1',
      permission: 'enterprise_knowledge.read',
      context,
      options,
      loadCandidates: loader,
    })
    expect(denied.status).toBe('denied')
    expect(loader).not.toHaveBeenCalled()
  })

  it('loads candidates only after governance and rejects caller/context identity mismatch', async () => {
    const loader = vi.fn(async () => [memory()])
    const resolved = await resolveAuthorizedEnterpriseKnowledgeContext({
      store: storeWithPermission(),
      userId: 'user-1',
      permission: 'enterprise_knowledge.read',
      context,
      options,
      loadCandidates: loader,
    })
    expect(resolved).toMatchObject({ status: 'ready', items: [{ id: 'memory-1' }] })
    expect(loader).toHaveBeenCalledWith({ organizationId: 'org-1', workspaceId: 'ws-1', userId: 'user-1' })

    const mismatchLoader = vi.fn(async () => [memory()])
    const mismatch = await resolveAuthorizedEnterpriseKnowledgeContext({
      store: storeWithPermission(),
      userId: 'user-2',
      permission: 'enterprise_knowledge.read',
      context,
      options,
      loadCandidates: mismatchLoader,
    })
    expect(mismatch).toMatchObject({ status: 'invalid_request' })
    expect(mismatchLoader).not.toHaveBeenCalled()
  })
})
