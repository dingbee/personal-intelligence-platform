import { describe, expect, it } from 'vitest'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'
import { countDomainRecords, filterIntelligenceRecords, INTELLIGENCE_CENTRE_DOMAINS, isCrossDomainRecord } from '@/modules/v2/intelligenceCentreModel'

const record = (recordType: IntelligenceRecord['recordType'], overrides: Partial<IntelligenceRecord> = {}): IntelligenceRecord => ({
  id: recordType,
  workspaceId: 'space-1',
  userId: 'user-1',
  journeyId: null,
  domainKey: null,
  recordType,
  status: 'completed',
  summary: `${recordType} record`,
  structuredOutput: {},
  provenance: null,
  operationId: null,
  providerId: null,
  conversationId: null,
  executionRequestId: null,
  parentRecordId: null,
  expectedOutcome: null,
  actualOutcome: null,
  outcomeEvaluatedAt: null,
  createdAt: '2026-10-06T10:00:00.000Z',
  updatedAt: '2026-10-06T10:00:00.000Z',
  ...overrides,
  it('offers exactly the eight canonical domain filters', () => {
    expect(INTELLIGENCE_CENTRE_DOMAINS.map((domain) => domain.key)).toEqual(['finance', 'marketing', 'sales', 'operations', 'hr', 'legal', 'customer', 'risk'])
  })
  it('filters domain records without relabelling legacy records', () => {
    const finance = record('analysis', { id: 'finance-1', domainKey: 'finance' })
    const marketing = record('analysis', { id: 'marketing-1', domainKey: 'marketing' })
    const legacy = record('analysis', { id: 'legacy-1', domainKey: null })
    expect(filterIntelligenceRecords([finance, marketing, legacy], 'finance').map((item) => item.id)).toEqual(['finance-1'])
    expect(filterIntelligenceRecords([finance, marketing, legacy], 'all')).toHaveLength(3)
    expect(countDomainRecords([finance, marketing, legacy], 'marketing')).toBe(1)
  })
  it('identifies cross-domain records only by their explicit output marker', () => {
    const cross = record('analysis', { id: 'cross-1', structuredOutput: { crossDomain: true, domains: ['finance', 'marketing'] } })
    const legacy = record('analysis', { id: 'legacy-1', structuredOutput: { domain: 'finance' } })
    expect(isCrossDomainRecord(cross)).toBe(true)
    expect(filterIntelligenceRecords([cross, legacy], 'cross-domain').map((item) => item.id)).toEqual(['cross-1'])
    expect(isCrossDomainRecord(legacy)).toBe(false)
  })

})

describe('V2 Intelligence Centre evidence boundary', () => {
  it('keeps the six-stage model distinct from legacy ledger record types', () => {
    expect(record('data').recordType).toBe('data')
    expect(record('analysis').recordType).toBe('analysis')
    expect(record('decision').recordType).toBe('decision')
    expect(record('execution').recordType).toBe('execution')
  })

  it('preserves Space scope on evidence records', () => {
    expect(record('research').workspaceId).toBe('space-1')
  })

  it('does not pretend legacy records are canonical V2 resources', () => {
    expect(record('data').recordType).not.toBe('signal')
    expect(record('analysis').recordType).not.toBe('insight')
    expect(record('decision').recordType).not.toBe('recommendation')
  })
})
