/** IF-02 shared contract: business domain identity is separate from engine record type. */
export const INTELLIGENCE_DOMAIN_KEYS = [
  'finance',
  'marketing',
  'sales',
  'operations',
  'hr',
  'legal',
  'customer',
  'risk',
] as const

import type { IntelligenceDomainKey } from '@/shared/types/database'
export type { IntelligenceDomainKey }
export type IntelligenceEvidenceKind =
  | 'verified_fact'
  | 'deterministic_calculation'
  | 'assumption'
  | 'hypothesis'
  | 'recommendation'

export type CapabilityReadiness = 'registered' | 'implemented' | 'tested' | 'verified'

export interface IntelligenceEvidenceItem {
  id: string
  kind: IntelligenceEvidenceKind
  statement: string
  sourceRef: string | null
  confidence: number | null
}

export interface DomainIntelligenceOutput {
  schemaVersion: 1
  domain: IntelligenceDomainKey
  evidence: IntelligenceEvidenceItem[]
  findings: Array<{
    id: string
    statement: string
    evidenceIds: string[]
  }>
  recommendations: Array<{
    id: string
    statement: string
    evidenceIds: string[]
    requiresApproval: boolean
  }>
  metadata?: Record<string, unknown>
}

/** Makes persistence durability explicit; a best-effort engine result is not a durable ledger record. */
export type IntelligencePersistenceOutcome =
  | { status: 'persisted'; recordId: string; domain: IntelligenceDomainKey }
  | { status: 'not_persisted'; domain: IntelligenceDomainKey; reason: string }

export function isIntelligenceDomainKey(value: unknown): value is IntelligenceDomainKey {
  return typeof value === 'string' && (INTELLIGENCE_DOMAIN_KEYS as readonly string[]).includes(value)
}

export function validateDomainIntelligenceOutput(
  value: unknown,
  expectedDomain: IntelligenceDomainKey,
): value is DomainIntelligenceOutput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const output = value as Record<string, unknown>
  if (output.schemaVersion !== 1 || output.domain !== expectedDomain) return false
  if (!Array.isArray(output.evidence) || !Array.isArray(output.findings) || !Array.isArray(output.recommendations)) return false

  const evidenceIds = new Set<string>()
  for (const item of output.evidence) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false
    const evidence = item as Record<string, unknown>
    if (typeof evidence.id !== 'string' || !evidence.id.trim() || evidenceIds.has(evidence.id)) return false
    if (!['verified_fact', 'deterministic_calculation', 'assumption', 'hypothesis', 'recommendation'].includes(String(evidence.kind))) return false
    if (typeof evidence.statement !== 'string' || !evidence.statement.trim()) return false
    if (evidence.sourceRef !== null && typeof evidence.sourceRef !== 'string') return false
    if (evidence.confidence !== null && (typeof evidence.confidence !== 'number' || evidence.confidence < 0 || evidence.confidence > 1)) return false
    evidenceIds.add(evidence.id)
  }

  for (const collection of [output.findings, output.recommendations]) {
    for (const item of collection) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return false
      const entry = item as Record<string, unknown>
      if (typeof entry.id !== 'string' || !entry.id.trim()) return false
      if (typeof entry.statement !== 'string' || !entry.statement.trim()) return false
      if (!Array.isArray(entry.evidenceIds) || !entry.evidenceIds.every(id => typeof id === 'string' && evidenceIds.has(id))) return false
      if (collection === output.recommendations && typeof entry.requiresApproval !== 'boolean') return false
    }
  }
  return true
}
