import { describe, expect, it } from 'vitest'
import {
  reconcileCrossDomainObservations,
  type EIFCrossDomainObservation,
} from './enterpriseCrossDomainReconciliation'

const now = '2026-10-10T12:00:00.000Z'
const context = { organizationId: 'org-1', workspaceId: 'space-1' }

function observation(overrides: Partial<EIFCrossDomainObservation> = {}): EIFCrossDomainObservation {
  return {
    organizationId: 'org-1',
    workspaceId: 'space-1',
    entityId: 'entity-supplier-1',
    domain: 'finance',
    attribute: 'supplier.tax_id',
    valueType: 'string',
    value: 'TZ-12345',
    evidence: {
      sourceId: 'source-finance',
      sourceRecordId: 'record-1',
      sourceSystem: 'finance-suite',
      observedAt: '2026-10-10T11:00:00.000Z',
      locator: 'suppliers/record-1',
    },
    ...overrides,
  }
}

describe('EIF-05 cross-domain reconciliation', () => {
  it('marks independently sourced matching values consistent and preserves lineage', () => {
    const result = reconcileCrossDomainObservations([
      observation(),
      observation({
        domain: 'procurement',
        evidence: { sourceId: 'source-procurement', sourceRecordId: 'vendor-7', sourceSystem: 'procurement-suite', observedAt: '2026-10-10T10:00:00.000Z' },
      }),
    ], context, now)
    expect(result).toMatchObject({
      status: 'reconciled',
      summary: { singleSource: 0, consistent: 1, conflicts: 0 },
      groups: [{
        entityId: 'entity-supplier-1',
        attribute: 'supplier.tax_id',
        outcome: 'consistent',
        domains: ['finance', 'procurement'],
        observations: [{ evidence: { sourceId: 'source-finance', sourceRecordId: 'record-1' } }, { evidence: { sourceId: 'source-procurement', sourceRecordId: 'vendor-7' } }],
      }],
    })
  })

  it('surfaces disagreements as conflicts without selecting a winner', () => {
    const result = reconcileCrossDomainObservations([
      observation(),
      observation({
        domain: 'procurement',
        value: 'TZ-99999',
        evidence: { sourceId: 'source-procurement', sourceRecordId: 'vendor-7', sourceSystem: 'procurement-suite', observedAt: '2026-10-10T10:00:00.000Z' },
      }),
    ], context, now)
    expect(result).toMatchObject({ status: 'reconciled', summary: { conflicts: 1 }, groups: [{ outcome: 'conflict', distinctValues: ['TZ-12345', 'TZ-99999'] }] })
  })

  it('normalizes string casing and whitespace but does not fuzzy match', () => {
    const result = reconcileCrossDomainObservations([
      observation({ value: '  NORTH   STAR  ' }),
      observation({ domain: 'sales', value: 'north star', evidence: { sourceId: 'sales', sourceRecordId: 'r2', sourceSystem: 'sales', observedAt: '2026-10-10T10:00:00.000Z' } }),
    ], context, now)
    expect(result).toMatchObject({ status: 'reconciled', summary: { consistent: 1 } })
  })

  it('compares numeric values exactly and rejects non-finite values', () => {
    const result = reconcileCrossDomainObservations([
      observation({ valueType: 'number', value: 100 }),
      observation({ domain: 'sales', valueType: 'number', value: 100, evidence: { sourceId: 'sales', sourceRecordId: 'r2', sourceSystem: 'sales', observedAt: '2026-10-10T10:00:00.000Z' } }),
    ], context, now)
    expect(result).toMatchObject({ status: 'reconciled', summary: { consistent: 1 } })
    expect(reconcileCrossDomainObservations([observation({ valueType: 'number', value: Number.NaN })], context, now)).toMatchObject({ status: 'rejected', issues: [{ code: 'invalid_value' }] })
  })

  it('normalizes equivalent dates to the same instant', () => {
    const result = reconcileCrossDomainObservations([
      observation({ valueType: 'date', value: '2026-10-10T10:00:00.000Z' }),
      observation({ domain: 'sales', valueType: 'date', value: '2026-10-10T12:00:00+02:00', evidence: { sourceId: 'sales', sourceRecordId: 'r2', sourceSystem: 'sales', observedAt: '2026-10-10T10:00:00.000Z' } }),
    ], context, now)
    expect(result).toMatchObject({ status: 'reconciled', summary: { consistent: 1 } })
  })

  it('fails closed on cross-scope evidence instead of returning partial results', () => {
    const result = reconcileCrossDomainObservations([
      observation(),
      observation({ workspaceId: 'space-other', domain: 'sales', evidence: { sourceId: 'sales', sourceRecordId: 'r2', sourceSystem: 'sales', observedAt: '2026-10-10T10:00:00.000Z' } }),
    ], context, now)
    expect(result).toMatchObject({ status: 'rejected', issues: [{ code: 'scope_mismatch', observationIndex: 1 }] })
  })

  it('rejects future-dated or untraceable evidence', () => {
    expect(reconcileCrossDomainObservations([observation({
      evidence: { sourceId: 's', sourceRecordId: 'r', sourceSystem: 'sys', observedAt: '2026-10-10T12:00:01.000Z' },
    })], context, now)).toMatchObject({ status: 'rejected', issues: [{ code: 'invalid_evidence' }] })
    expect(reconcileCrossDomainObservations([observation({
      evidence: { sourceId: '', sourceRecordId: 'r', sourceSystem: 'sys', observedAt: '2026-10-10T11:00:00.000Z' },
    })], context, now)).toMatchObject({ status: 'rejected', issues: [{ code: 'invalid_evidence' }] })
  })

  it('rejects duplicate source evidence for the same entity attribute', () => {
    expect(reconcileCrossDomainObservations([
      observation(),
      observation({ domain: 'procurement' }),
    ], context, now)).toMatchObject({ status: 'rejected', issues: [{ code: 'duplicate_evidence', observationIndex: 1 }] })
  })

  it('returns single-source groups as unverified, not as cross-domain agreement', () => {
    expect(reconcileCrossDomainObservations([observation()], context, now)).toMatchObject({
      status: 'reconciled',
      summary: { singleSource: 1, consistent: 0, conflicts: 0 },
      groups: [{ outcome: 'single_source' }],
    })
  })

  it('produces stable group ordering regardless of input group order', () => {
    const first = observation({ entityId: 'entity-b', attribute: 'z.key' })
    const second = observation({ entityId: 'entity-a', attribute: 'a.key', evidence: { sourceId: 's2', sourceRecordId: 'r2', sourceSystem: 'sys', observedAt: '2026-10-10T11:00:00.000Z' } })
    const result = reconcileCrossDomainObservations([first, second], context, now)
    expect(result).toMatchObject({ status: 'reconciled', groups: [{ entityId: 'entity-a' }, { entityId: 'entity-b' }] })
  })
  it('does not report same-domain observations as cross-domain agreement', () => {
    const result = reconcileCrossDomainObservations([
      observation(),
      observation({
        evidence: { sourceId: 'finance-archive', sourceRecordId: 'record-2', sourceSystem: 'finance-suite', observedAt: '2026-10-10T10:00:00.000Z' },
      }),
    ], context, now)
    expect(result).toMatchObject({
      status: 'reconciled',
      summary: { singleSource: 1, consistent: 0, conflicts: 0 },
      groups: [{ outcome: 'single_source', domains: ['finance'] }],
    })
  })

  it('rejects inconsistent declared value types for the same entity attribute', () => {
    const result = reconcileCrossDomainObservations([
      observation(),
      observation({
        domain: 'sales',
        valueType: 'number',
        value: 12345,
        evidence: { sourceId: 'sales', sourceRecordId: 'r2', sourceSystem: 'sales', observedAt: '2026-10-10T10:00:00.000Z' },
      }),
    ], context, now)
    expect(result).toMatchObject({
      status: 'rejected',
      issues: [{ code: 'invalid_value', observationIndex: 1 }],
    })
  })

})
