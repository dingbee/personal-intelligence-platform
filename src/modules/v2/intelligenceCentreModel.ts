import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'
import type { IntelligenceDomainKey } from '@/modules/intelligence-ledger/domainContract'

export const INTELLIGENCE_CENTRE_DOMAINS: ReadonlyArray<{ key: IntelligenceDomainKey; label: string }> = [
  { key: 'finance', label: 'Finance' }, { key: 'marketing', label: 'Marketing' },
  { key: 'sales', label: 'Sales' }, { key: 'operations', label: 'Operations' },
  { key: 'hr', label: 'HR' }, { key: 'legal', label: 'Legal' },
  { key: 'customer', label: 'Customer' }, { key: 'risk', label: 'Risk' },
]
export type IntelligenceCentreFilter = 'all' | 'cross-domain' | IntelligenceDomainKey
export function isCrossDomainRecord(record: IntelligenceRecord): boolean {
  const output: unknown = record.structuredOutput
  return typeof output === 'object' && output !== null && !Array.isArray(output)
    && (output as Record<string, unknown>).crossDomain === true
}
export function filterIntelligenceRecords(records: readonly IntelligenceRecord[], filter: IntelligenceCentreFilter): IntelligenceRecord[] {
  if (filter === 'all') return [...records]
  if (filter === 'cross-domain') return records.filter(isCrossDomainRecord)
  return records.filter((record) => record.domainKey === filter)
}
export function countDomainRecords(records: readonly IntelligenceRecord[], domain: IntelligenceDomainKey): number {
  return records.filter((record) => record.domainKey === domain).length
}
