import { describe, expect, it } from 'vitest'
import {
  buildEnterpriseEntityObservation,
  normalizeEnterpriseEntityName,
  reconcileEnterpriseEntity,
  validateEnterpriseEntityObservation,
  type EnterpriseEntityIdentity,
  type EnterpriseEntityObservation,
} from './enterpriseEntityIntelligence'
import type { EnterpriseSourceContract, EnterpriseSourceSnapshot } from './enterpriseSourceContract'

//} from './enterpriseEntityIntelligence'

const context = { organizationId: 'org-1', workspaceId: 'space-1', userId: 'user-1' }

function makeObservation(overrides: Partial<EnterpriseEntityObservation> = {}): EnterpriseEntityObservation {
  return {
    organizationId: 'org-1',
    workspaceId: 'space-1',
    entityType: 'supplier',
    name: 'North Star Supplies Ltd.',
    aliases: [],
    identifiers: [{ namespace: 'supplier_code', value: 'SUP-0042' }],
    evidence: {
      sourceId: 'source-procurement',
      sourceRecordId: 'vendor-42',
      sourceSystem: 'procurement-suite',
      observedAt: '2026-10-10T09:00:00.000Z',
      locator: 'vendors/vendor-42',
    },
    ...overrides,
  }
}

function makeIdentity(overrides: Partial<EnterpriseEntityIdentity> = {}): EnterpriseEntityIdentity {
  return {
    id: 'entity-supplier-1',
    organizationId: 'org-1',
    workspaceId: 'space-1',
    entityType: 'supplier',
    canonicalName: 'North Star Supplies',
    aliases: ['North Star Supplies Ltd'],
    identifiers: [{ namespace: 'supplier_code', value: 'SUP-0042' }],
    evidence: [{
      sourceId: 'source-finance',
      sourceRecordId: 'supplier-0042',
      sourceSystem: 'finance-suite',
      observedAt: '2026-10-10T08:00:00.000Z',
    }],
    ...overrides,
  }
}

describe('EIF-02 enterprise entity identity', () => {
  it('normalizes names with the existing exact-title normalization rules, not fuzzy matching', () => {
    expect(normalizeEnterpriseEntityName('  North-Star, Supplies Ltd. ')).toBe('north star supplies ltd')
    expect(normalizeEnterpriseEntityName('NorthStar Supplies')).not.toBe(normalizeEnterpriseEntityName('North Star Supplies'))
  })

  it('accepts an observation only when it has scoped identity and source evidence', () => {
    expect(validateEnterpriseEntityObservation(makeObservation(), context).valid).toBe(true)
  })

  it('rejects observations outside the active organization or Business Space', () => {
    const result = validateEnterpriseEntityObservation(makeObservation({ workspaceId: 'space-2' }), context)
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('scope_mismatch')
  })

  it('rejects missing source provenance and duplicate namespaced identifiers', () => {
    const invalid = makeObservation({
      identifiers: [
        { namespace: 'supplier_code', value: 'SUP-1' },
        { namespace: 'SUPPLIER_CODE', value: 'sup-1' },
      ],
      evidence: { sourceId: '', sourceRecordId: 'record-1', sourceSystem: 'erp', observedAt: 'not-a-date' },
    })
    const result = validateEnterpriseEntityObservation(invalid, context)
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('invalid_identifier')
    expect(result.issues.map(issue => issue.code)).toContain('invalid_evidence')
  })

  it('matches a single in-scope identity by exact namespaced identifier', () => {
    expect(reconcileEnterpriseEntity(makeObservation(), [makeIdentity()], context)).toMatchObject({
      outcome: 'matched',
      entityId: 'entity-supplier-1',
      basis: 'exact_identifier',
    })
  })

  it('does not reveal or match identities from another organization or Space', () => {
    const outOfScope = makeIdentity({ id: 'private-other-space', workspaceId: 'space-2' })
    expect(reconcileEnterpriseEntity(makeObservation({ identifiers: [] }), [outOfScope], context)).toMatchObject({
      outcome: 'new_entity',
    })
  })

  it('requires review for a name-only match rather than auto-merging', () => {
    const result = reconcileEnterpriseEntity(makeObservation({ identifiers: [] }), [makeIdentity()], context)
    expect(result).toMatchObject({ outcome: 'review_required', basis: 'exact_name', candidateEntityIds: ['entity-supplier-1'] })
  })

  it('returns conflict when one identifier is attached to multiple identities', () => {
    const second = makeIdentity({ id: 'entity-supplier-2', canonicalName: 'Another supplier', aliases: [] })
    expect(reconcileEnterpriseEntity(makeObservation(), [makeIdentity(), second], context)).toMatchObject({
      outcome: 'conflict',
      reason: 'ambiguous_identity',
      candidateEntityIds: ['entity-supplier-1', 'entity-supplier-2'],
    })
  })

  it('returns conflict when an exact identifier points to another entity type', () => {
    expect(reconcileEnterpriseEntity(makeObservation(), [makeIdentity({ entityType: 'customer' })], context)).toMatchObject({
      outcome: 'conflict',
      reason: 'entity_type_mismatch',
    })
  })

  it('detects conflicting values in a shared identifier namespace', () => {
    const result = reconcileEnterpriseEntity(
      makeObservation({ identifiers: [{ namespace: 'supplier_code', value: 'SUP-9999' }] }),
      [makeIdentity()],
      context,
    )
    expect(result).toMatchObject({ outcome: 'conflict', reason: 'identifier_collision' })
  })

  it('surfaces a same-name different-type collision instead of creating a duplicate silently', () => {
    expect(reconcileEnterpriseEntity(
      makeObservation({ identifiers: [], name: 'North Star Supplies' }),
      [makeIdentity({ entityType: 'customer' })],
      context,
    )).toMatchObject({ outcome: 'conflict', reason: 'entity_type_mismatch' })
  })

  it('returns a new-entity proposal when no authorized candidate matches', () => {
    expect(reconcileEnterpriseEntity(makeObservation(), [], context)).toMatchObject({
      outcome: 'new_entity',
      normalizedName: 'north star supplies ltd',
    })
  })

  it('fails closed when an in-scope candidate identity is malformed', () => {
    expect(reconcileEnterpriseEntity(makeObservation(), [makeIdentity({ canonicalName: ' ' })], context)).toMatchObject({
      outcome: 'rejected',
      reason: 'invalid_candidate',
    })
  })
})


describe('EIF-02 source-to-entity observation boundary', () => {
  const sourceContract: EnterpriseSourceContract = {
    id: 'source-procurement',
    organizationId: 'org-1',
    workspaceId: 'space-1',
    name: 'Procurement system',
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
      sourceRecordId: 'vendor-42',
      sourceUpdatedAt: '2026-10-10T08:45:00.000Z',
      value: { name: 'North Star Supplies Ltd.', code: 'SUP-0042' },
      provenance: {
        sourceId: 'source-procurement',
        sourceSystem: 'procurement-suite',
        retrievedAt: '2026-10-10T09:00:00.000Z',
        locator: 'vendors/vendor-42',
      },
    }],
  }

  it('builds entity evidence from an active, scoped, fresh EIF-01 snapshot', () => {
    const result = buildEnterpriseEntityObservation({
      contract: sourceContract,
      snapshot: sourceSnapshot,
      sourceRecordId: 'vendor-42',
      entityType: 'supplier',
      name: 'North Star Supplies Ltd.',
      identifiers: [{ namespace: 'supplier_code', value: 'SUP-0042' }],
      context,
      now: '2026-10-10T09:10:00.000Z',
    })
    expect(result.valid).toBe(true)
    expect(result.observation?.evidence).toEqual({
      sourceId: 'source-procurement',
      sourceRecordId: 'vendor-42',
      sourceSystem: 'procurement-suite',
      observedAt: '2026-10-10T09:00:00.000Z',
      locator: 'vendors/vendor-42',
    })
  })

  it('rejects stale source snapshots before creating entity evidence', () => {
    const result = buildEnterpriseEntityObservation({
      contract: sourceContract,
      snapshot: { ...sourceSnapshot, observedAt: '2026-10-10T07:00:00.000Z' },
      sourceRecordId: 'vendor-42',
      entityType: 'supplier',
      name: 'North Star Supplies Ltd.',
      identifiers: [],
      context,
      now: '2026-10-10T09:10:00.000Z',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('stale_snapshot')
  })

  it('rejects a source record that is not present in the validated snapshot', () => {
    const result = buildEnterpriseEntityObservation({
      contract: sourceContract,
      snapshot: sourceSnapshot,
      sourceRecordId: 'missing-record',
      entityType: 'supplier',
      name: 'North Star Supplies Ltd.',
      identifiers: [],
      context,
      now: '2026-10-10T09:10:00.000Z',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('source_record_not_found')
  })
})
