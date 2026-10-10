import { describe, expect, it } from 'vitest'
import {
  validateEnterpriseSourceContract,
  validateEnterpriseSourceSnapshot,
  type EnterpriseSourceContract,
  type EnterpriseSourceSnapshot,
} from './enterpriseSourceContract'

const context = { organizationId: 'org-1', workspaceId: 'space-1', userId: 'user-1' }

const contract: EnterpriseSourceContract = {
  id: 'source-finance-1',
  organizationId: 'org-1',
  workspaceId: 'space-1',
  name: 'Finance ledger',
  provider: 'finance-system',
  domain: 'finance',
  protocol: 'api',
  accessMode: 'read_only',
  status: 'active',
  capabilities: ['invoices.read', 'payments.read'],
  credentialRef: 'secret-ref:finance-ledger',
  freshness: { maxAgeSeconds: 3600 },
}

const snapshot: EnterpriseSourceSnapshot = {
  sourceId: contract.id,
  organizationId: context.organizationId,
  workspaceId: context.workspaceId!,
  observedAt: '2026-10-10T09:00:00.000Z',
  records: [{
    sourceRecordId: 'invoice-1',
    sourceUpdatedAt: '2026-10-10T08:45:00.000Z',
    value: { amount: 1200, currency: 'TZS', status: 'open' },
    provenance: {
      sourceId: contract.id,
      sourceSystem: contract.provider,
      retrievedAt: '2026-10-10T09:00:00.000Z',
      locator: 'invoices/invoice-1',
    },
  }],
}

describe('EIF-01 enterprise source contracts', () => {
  it('accepts a read-only source in the active organization and Space', () => {
    expect(validateEnterpriseSourceContract(contract, context).valid).toBe(true)
  })

  it('rejects a source from another organization or Space', () => {
    const result = validateEnterpriseSourceContract(
      { ...contract, workspaceId: 'space-2' },
      context,
    )
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('scope_mismatch')
  })

  it('rejects write-capable or non-read capabilities', () => {
    const result = validateEnterpriseSourceContract(
      { ...contract, accessMode: 'write' as 'read_only', capabilities: ['payments.write'] },
      context,
    )
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('write_access_forbidden')
    expect(result.issues.map(issue => issue.code)).toContain('invalid_capabilities')
  })

  it('rejects duplicate capabilities and invalid freshness limits', () => {
    const result = validateEnterpriseSourceContract(
      { ...contract, capabilities: ['invoices.read', 'invoices.read'], freshness: { maxAgeSeconds: 0 } },
      context,
    )
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('invalid_capabilities')
    expect(result.issues.map(issue => issue.code)).toContain('invalid_freshness_policy')
  })

  it('accepts a fresh snapshot with traceable source provenance', () => {
    expect(validateEnterpriseSourceSnapshot(contract, context, snapshot, {
      now: '2026-10-10T09:10:00.000Z',
    }).valid).toBe(true)
  })

  it('rejects stale and future snapshots', () => {
    const stale = validateEnterpriseSourceSnapshot(contract, context, {
      ...snapshot, observedAt: '2026-10-10T07:00:00.000Z',
    }, { now: '2026-10-10T09:10:00.000Z' })
    expect(stale.issues.map(issue => issue.code)).toContain('stale_snapshot')

    const future = validateEnterpriseSourceSnapshot(contract, context, {
      ...snapshot, observedAt: '2026-10-10T10:00:00.000Z',
    }, { now: '2026-10-10T09:10:00.000Z' })
    expect(future.issues.map(issue => issue.code)).toContain('future_snapshot')
  })

  it('rejects duplicate records and altered provenance', () => {
    const result = validateEnterpriseSourceSnapshot(contract, context, {
      ...snapshot,
      records: [
        snapshot.records[0]!,
        { ...snapshot.records[0]!, provenance: { ...snapshot.records[0]!.provenance, sourceId: 'other-source' } },
      ],
    }, { now: '2026-10-10T09:10:00.000Z' })
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('duplicate_source_record')
    expect(result.issues.map(issue => issue.code)).toContain('invalid_record_provenance')
  })

  it('rejects snapshots from inactive sources and mismatched scope', () => {
    const result = validateEnterpriseSourceSnapshot(
      { ...contract, status: 'paused' },
      context,
      { ...snapshot, workspaceId: 'space-2' },
      { now: '2026-10-10T09:10:00.000Z' },
    )
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('source_not_active')
    expect(result.issues.map(issue => issue.code)).toContain('snapshot_source_mismatch')
  })
})
