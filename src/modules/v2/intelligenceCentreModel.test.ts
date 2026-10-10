import { describe, expect, it } from 'vitest'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'
import { countDomainRecords, filterIntelligenceRecords, INTELLIGENCE_CENTRE_DOMAINS, isCrossDomainRecord } from '@/modules/v2/intelligenceCentreModel'
const record = (recordType: IntelligenceRecord['recordType'], overrides: Partial<IntelligenceRecord> = {}): IntelligenceRecord => ({
 id: recordType, workspaceId: 'space-1', userId: 'user-1', journeyId: null, domainKey: null, recordType, status: 'completed',
 summary: `${recordType} record`, structuredOutput: {}, provenance: null, operationId: null, providerId: null,
 conversationId: null, executionRequestId: null, parentRecordId: null, expectedOutcome: null, actualOutcome: null,
 outcomeEvaluatedAt: null, createdAt: '2026-10-06T10:00:00.000Z', updatedAt: '2026-10-06T10:00:00.000Z', ...overrides,
})
describe('Intelligence Centre domain filtering', () => {
 it('exposes exactly the eight canonical domains', () => {
  expect(INTELLIGENCE_CENTRE_DOMAINS.map(domain => domain.key)).toEqual(['finance','marketing','sales','operations','hr','legal','customer','risk'])
 })
 it('filters by explicit domain key and preserves unclassified legacy records in all-records view', () => {
  const finance=record('analysis',{id:'f',domainKey:'finance'}), marketing=record('analysis',{id:'m',domainKey:'marketing'}), legacy=record('analysis',{id:'legacy',domainKey:null})
  expect(filterIntelligenceRecords([finance,marketing,legacy],'finance').map(item=>item.id)).toEqual(['f'])
  expect(filterIntelligenceRecords([finance,marketing,legacy],'all')).toHaveLength(3)
  expect(countDomainRecords([finance,marketing,legacy],'marketing')).toBe(1)
 })
 it('recognizes cross-domain records only by explicit IF-04 output marker', () => {
  const cross=record('analysis',{id:'cross',structuredOutput:{crossDomain:true,domains:['finance','marketing']}})
  const legacy=record('analysis',{id:'legacy',structuredOutput:{domain:'finance'}})
  expect(isCrossDomainRecord(cross)).toBe(true)
  expect(filterIntelligenceRecords([cross,legacy],'cross-domain').map(item=>item.id)).toEqual(['cross'])
  expect(isCrossDomainRecord(legacy)).toBe(false)
 })
})
