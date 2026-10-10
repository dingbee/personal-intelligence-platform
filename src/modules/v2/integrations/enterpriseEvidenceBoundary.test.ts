import { describe, expect, it, vi } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import { createWorkspaceMembership } from '../workspace/service'
import { resolveAuthorizedEnterpriseEntity } from './enterpriseEvidenceBoundary'
import type { EnterpriseEntityIdentity } from './enterpriseEntityIntelligence'
import type { EnterpriseSourceContract, EnterpriseSourceSnapshot } from './enterpriseSourceContract'

const context = { organizationId: 'org-1', workspaceId: 'space-1', userId: 'user-1' }
const meta = { createdAt: '2026-10-10T08:00:00.000Z', updatedAt: '2026-10-10T08:00:00.000Z' }

function makeStore(permissionKey = 'enterprise.entity.reconcile') {
  const store = new V2ControlPlaneStore()
  store.save('organization', { id: 'org-1', organizationId: 'org-1', name: 'Org', slug: 'org', status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  store.save('workspace', { id: 'space-1', organizationId: 'org-1', name: 'Business Space', slug: 'space', status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  store.save('user', { id: 'user-1', organizationId: 'org-1', email: 'user@example.com', displayName: 'User', status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  store.save('permission', { id: 'perm-enterprise-entity', organizationId: 'org-1', key: permissionKey, status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  store.save('role', { id: 'role-editor', organizationId: 'org-1', name: 'Editor', permissions: ['perm-enterprise-entity'], status: 'active', createdAt: meta.createdAt, updatedAt: meta.updatedAt })
  createWorkspaceMembership(store, { organizationId: 'org-1', workspaceId: 'space-1', userId: 'user-1', roleId: 'role-editor' }, meta)
  return store
}

const sourceContract: EnterpriseSourceContract = {
  id: 'source-procurement',
  organizationId: 'org-1',
  workspaceId: 'space-1',
  name: 'Procurement',
  provider: 'procurement-suite',
  domain: 'procurement',
  protocol: 'api',
  accessMode: 'read_only',
  status: 'active',
  capabilities: ['suppliers.read'],
  freshness: { maxAgeSeconds: 3600 },
}

const sourceSnapshot: EnterpriseSourceSnapshot = {
  sourceId: 'source-procurement',
  organizationId: 'org-1',
  workspaceId: 'space-1',
  observedAt: '2026-10-10T09:00:00.000Z',
  records: [{
    sourceRecordId: 'supplier-42',
    value: { name: 'North Star Supplies Ltd', code: 'SUP-42' },
    provenance: {
      sourceId: 'source-procurement',
      sourceSystem: 'procurement-suite',
      retrievedAt: '2026-10-10T09:00:00.000Z',
      locator: 'suppliers/42',
    },
  }],
}

const candidate: EnterpriseEntityIdentity = {
  id: 'entity-42',
  organizationId: 'org-1',
  workspaceId: 'space-1',
  entityType: 'supplier',
  canonicalName: 'North Star Supplies',
  aliases: [],
  identifiers: [{ namespace: 'supplier_code', value: 'SUP-42' }],
  evidence: [{
    sourceId: 'source-finance',
    sourceRecordId: 'supplier-42',
    sourceSystem: 'finance-suite',
    observedAt: '2026-10-10T08:00:00.000Z',
  }],
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    store: makeStore(),
    userId: 'user-1',
    permission: 'enterprise.entity.reconcile',
    context,
    sourceContract,
    sourceSnapshot,
    sourceRecordId: 'supplier-42',
    requiredCapability: 'suppliers.read',
    entityType: 'supplier' as const,
    name: 'North Star Supplies Ltd',
    identifiers: [{ namespace: 'supplier_code', value: 'SUP-42' }],
    now: '2026-10-10T09:10:00.000Z',
    loadCandidates: vi.fn(async () => [candidate]),
    ...overrides,
  }
}

describe('EIF-03 governed enterprise evidence boundary', () => {
  it('authorizes before loading candidates and preserves validated source lineage', async () => {
    const params = makeParams()
    const result = await resolveAuthorizedEnterpriseEntity(params)
    expect(result.status).toBe('resolved')
    expect(params.loadCandidates).toHaveBeenCalledOnce()
    expect(params.loadCandidates).toHaveBeenCalledWith({
      organizationId: 'org-1',
      workspaceId: 'space-1',
      userId: 'user-1',
    })
    if (result.status !== 'resolved') throw new Error('Expected a resolved result')
    expect(result.reconciliation).toMatchObject({ outcome: 'matched', entityId: 'entity-42', basis: 'exact_identifier' })
    expect(result.observation.evidence).toEqual({
      sourceId: 'source-procurement',
      sourceRecordId: 'supplier-42',
      sourceSystem: 'procurement-suite',
      observedAt: '2026-10-10T09:00:00.000Z',
      locator: 'suppliers/42',
    })
  })

  it('does not load candidate identities when RBAC denies the requested permission', async () => {
    const params = makeParams({ permission: 'enterprise.entity.delete' })
    const result = await resolveAuthorizedEnterpriseEntity(params)
    expect(result).toMatchObject({ status: 'denied', governance: { allowed: false } })
    expect(params.loadCandidates).not.toHaveBeenCalled()
  })

  it('rejects a caller/context identity mismatch before authorization or candidate loading', async () => {
    const params = makeParams({ context: { ...context, userId: 'user-2' } })
    const result = await resolveAuthorizedEnterpriseEntity(params)
    expect(result).toMatchObject({ status: 'scope_violation' })
    expect(params.loadCandidates).not.toHaveBeenCalled()
  })

  it('rejects a capability not granted by the source contract before candidate loading', async () => {
    const params = makeParams({ requiredCapability: 'invoices.read' })
    const result = await resolveAuthorizedEnterpriseEntity(params)
    expect(result).toMatchObject({ status: 'invalid_source', issues: [{ code: 'source_capability_not_granted' }] })
    expect(params.loadCandidates).not.toHaveBeenCalled()
  })

  it('rejects stale source evidence before candidate loading', async () => {
    const params = makeParams({
      sourceSnapshot: { ...sourceSnapshot, observedAt: '2026-10-10T07:00:00.000Z' },
    })
    const result = await resolveAuthorizedEnterpriseEntity(params)
    expect(result).toMatchObject({ status: 'invalid_source' })
    expect(params.loadCandidates).not.toHaveBeenCalled()
  })

  it('fails closed when the candidate loader leaks another workspace identity', async () => {
    const params = makeParams({
      loadCandidates: vi.fn(async () => [{ ...candidate, workspaceId: 'space-2' }]),
    })
    const result = await resolveAuthorizedEnterpriseEntity(params)
    expect(result).toMatchObject({ status: 'scope_violation' })
  })

  it('rejects duplicate canonical identity IDs from the candidate loader', async () => {
    const params = makeParams({ loadCandidates: vi.fn(async () => [candidate, candidate]) })
    const result = await resolveAuthorizedEnterpriseEntity(params)
    expect(result).toMatchObject({ status: 'scope_violation' })
  })
})
