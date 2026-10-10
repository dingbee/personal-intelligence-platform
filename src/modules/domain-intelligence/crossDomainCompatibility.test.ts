import { describe, expect, it } from 'vitest'
import { evaluateCrossDomainCompatibility, type CrossDomainEvidenceDescriptor } from '@/modules/domain-intelligence/crossDomainCompatibility'

function item(overrides: Partial<CrossDomainEvidenceDescriptor> = {}): CrossDomainEvidenceDescriptor {
  return {
    evidenceId: 'e-finance', domain: 'finance', sourceRef: 'report:finance', accessScopeId: 'workspace-1',
    metricKey: 'revenue', metricDefinition: 'Recognized revenue in the reporting period', unit: 'currency', currency: 'TZS',
    periodStart: '2026-09-01T00:00:00.000Z', periodEnd: '2026-10-01T00:00:00.000Z',
    timeZone: 'Africa/Dar_es_Salaam', grain: 'month', asOf: '2026-10-02T00:00:00.000Z',
    ...overrides,
  }
}
const options = { now: '2026-10-10T00:00:00.000Z', maxAgeDays: 30 }

describe('IF-04 cross-domain compatibility preflight', () => {
  it('accepts same-scope, same-period evidence from distinct domains even when the metrics differ', () => {
    const result = evaluateCrossDomainCompatibility([item(), item({ evidenceId: 'e-marketing', domain: 'marketing', sourceRef: 'campaign:spend', metricKey: 'ad_spend', metricDefinition: 'Paid media spend', unit: 'currency' })], options)
    expect(result.status).toBe('compatible')
    expect(result.domains).toEqual(['finance', 'marketing'])
    expect(result.evidenceIds).toEqual(['e-finance', 'e-marketing'])
  })
  it('rejects inputs from different authorization scopes', () => {
    expect(evaluateCrossDomainCompatibility([item(), item({ evidenceId: 'e2', domain: 'sales', accessScopeId: 'workspace-2' })], options).issues.map(x => x.code)).toContain('scope_mismatch')
  })
  it('rejects period, timezone, and grain mismatch', () => {
    const result = evaluateCrossDomainCompatibility([item(), item({ evidenceId: 'e2', domain: 'sales', periodStart: '2026-09-01T00:00:00.000Z', periodEnd: '2026-09-15T00:00:00.000Z', timeZone: 'UTC', grain: 'day' })], options)
    expect(result.issues.map(x => x.code)).toEqual(expect.arrayContaining(['period_mismatch', 'timezone_mismatch', 'grain_mismatch']))
  })
  it('rejects conflicting definitions or units for the same metric key', () => {
    const result = evaluateCrossDomainCompatibility([item(), item({ evidenceId: 'e2', domain: 'sales', metricDefinition: 'Pipeline value', unit: 'count' })], options)
    expect(result.issues.map(x => x.code)).toEqual(expect.arrayContaining(['metric_definition_conflict', 'unit_conflict']))
  })
  it('rejects currency mismatches rather than inventing a conversion', () => {
    const result = evaluateCrossDomainCompatibility([item(), item({ evidenceId: 'e2', domain: 'sales', metricKey: 'bookings', metricDefinition: 'Booked revenue', currency: 'USD' })], options)
    expect(result.issues.map(x => x.code)).toContain('currency_conflict')
  })
  it('flags stale or future-dated evidence', () => {
    expect(evaluateCrossDomainCompatibility([item(), item({ evidenceId: 'e2', domain: 'sales', asOf: '2026-01-01T00:00:00.000Z' })], options).issues.map(x => x.code)).toContain('stale_evidence')
  })
  it('rejects missing source provenance and requires two distinct domains', () => {
    expect(evaluateCrossDomainCompatibility([item(), item({ evidenceId: 'e2', domain: 'sales', sourceRef: null })], options).issues.map(x => x.code)).toContain('missing_provenance')
    expect(evaluateCrossDomainCompatibility([item()], options).status).toBe('insufficient_evidence')
  })
  it('rejects invalid periods', () => {
    expect(evaluateCrossDomainCompatibility([item({ periodStart: 'bad-date' }), item({ evidenceId: 'e2', domain: 'sales' })], options).issues.map(x => x.code)).toContain('invalid_period')
  })
})