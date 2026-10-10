import type { IntelligenceDomainKey } from '@/modules/intelligence-ledger/domainContract'

export type CompatibilityStatus = 'compatible' | 'incompatible' | 'insufficient_evidence'
export type CompatibilityIssueCode =
  | 'too_few_domains'
  | 'scope_mismatch'
  | 'invalid_period'
  | 'period_mismatch'
  | 'timezone_mismatch'
  | 'grain_mismatch'
  | 'stale_evidence'
  | 'metric_definition_conflict'
  | 'unit_conflict'
  | 'currency_conflict'
  | 'missing_provenance'

export interface CrossDomainEvidenceDescriptor {
  evidenceId: string
  domain: IntelligenceDomainKey
  sourceRef: string | null
  /** Must be populated by the caller only after its existing authorization-aware retrieval succeeds. */
  accessScopeId: string
  metricKey: string
  metricDefinition: string
  unit: string
  currency: string | null
  periodStart: string
  periodEnd: string
  timeZone: string
  grain: string
  asOf: string
}

export interface CompatibilityIssue { code: CompatibilityIssueCode; evidenceIds: string[]; message: string }
export interface CrossDomainCompatibilityResult {
  status: CompatibilityStatus
  domains: IntelligenceDomainKey[]
  evidenceIds: string[]
  period: { start: string; end: string; timeZone: string } | null
  grain: string | null
  issues: CompatibilityIssue[]
}

function validDate(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Deterministic preflight for cross-domain composition. It does not retrieve
 * records or grant access: descriptors must come from already-authorized
 * source reads. Scope equality is a defence-in-depth consistency check, not
 * a substitute for RLS or server-side ownership checks.
 */
export function evaluateCrossDomainCompatibility(
  evidence: readonly CrossDomainEvidenceDescriptor[],
  options: { now?: string; maxAgeDays?: number } = {},
): CrossDomainCompatibilityResult {
  const issues: CompatibilityIssue[] = []
  const domains = [...new Set(evidence.map(item => item.domain))].sort()
  const evidenceIds = evidence.map(item => item.evidenceId)
  const add = (code: CompatibilityIssueCode, items: readonly CrossDomainEvidenceDescriptor[], message: string) => {
    issues.push({ code, evidenceIds: [...new Set(items.map(item => item.evidenceId))], message })
  }

  if (evidence.length < 2 || domains.length < 2) {
    add('too_few_domains', evidence, 'Cross-domain analysis requires evidence from at least two distinct domains.')
  }
  if (evidence.some(item => !item.evidenceId.trim() || !item.sourceRef?.trim() || !item.accessScopeId.trim() || !item.metricKey.trim() || !item.metricDefinition.trim() || !item.unit.trim() || !item.timeZone.trim() || !item.grain.trim())) {
    add('missing_provenance', evidence.filter(item => !item.evidenceId.trim() || !item.sourceRef?.trim() || !item.accessScopeId.trim() || !item.metricKey.trim() || !item.metricDefinition.trim() || !item.unit.trim() || !item.timeZone.trim() || !item.grain.trim()), 'Evidence is missing required source, scope, metric, unit, timezone, or grain metadata.')
  }

  const scopes = new Set(evidence.map(item => item.accessScopeId))
  if (scopes.size > 1) add('scope_mismatch', evidence, 'Evidence spans different authorization scopes; cross-scope composition is rejected.')

  const starts = evidence.map(item => validDate(item.periodStart))
  const ends = evidence.map(item => validDate(item.periodEnd))
  if (starts.some(value => value === null) || ends.some(value => value === null) || evidence.some(item => (validDate(item.periodStart) ?? Infinity) >= (validDate(item.periodEnd) ?? -Infinity))) {
    add('invalid_period', evidence, 'Every evidence period must have valid timestamps and a start strictly before its end.')
  } else if (new Set(evidence.map(item => `${item.periodStart}|${item.periodEnd}`)).size > 1) {
    add('period_mismatch', evidence, 'Evidence periods differ; normalize them explicitly before cross-domain comparison.')
  }
  if (new Set(evidence.map(item => item.timeZone)).size > 1) add('timezone_mismatch', evidence, 'Evidence uses different timezones; explicit timezone normalization is required.')
  if (new Set(evidence.map(item => item.grain)).size > 1) add('grain_mismatch', evidence, 'Evidence aggregation grains differ; aggregate to a common grain before composition.')

  const now = validDate(options.now ?? new Date().toISOString())
  const maxAgeMs = (options.maxAgeDays ?? 90) * 24 * 60 * 60 * 1000
  if (now === null || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    add('stale_evidence', evidence, 'Freshness evaluation configuration is invalid.')
  } else {
    const stale = evidence.filter(item => {
      const asOf = validDate(item.asOf)
      return asOf === null || asOf > now || now - asOf > maxAgeMs
    })
    if (stale.length) add('stale_evidence', stale, 'Evidence is invalid, future-dated, or older than the permitted freshness window.')
  }

  const byMetric = new Map<string, CrossDomainEvidenceDescriptor[]>()
  for (const item of evidence) byMetric.set(item.metricKey, [...(byMetric.get(item.metricKey) ?? []), item])
  for (const [metricKey, items] of byMetric) {
    if (new Set(items.map(item => item.metricDefinition)).size > 1) add('metric_definition_conflict', items, `Metric '${metricKey}' has conflicting definitions.`)
    if (new Set(items.map(item => item.unit)).size > 1) add('unit_conflict', items, `Metric '${metricKey}' uses incompatible units.`)
    if (new Set(items.map(item => item.currency ?? '')).size > 1) add('currency_conflict', items, `Metric '${metricKey}' uses incompatible currencies or currency metadata.`)
  }
  const currencies = new Set(evidence.map(item => item.currency).filter((value): value is string => value !== null))
  if (currencies.size > 1) add('currency_conflict', evidence.filter(item => item.currency !== null), 'Monetary evidence uses different currencies; an evidenced conversion is required before comparison.')

  const incompatibleCodes = new Set<CompatibilityIssueCode>(['scope_mismatch', 'invalid_period', 'period_mismatch', 'timezone_mismatch', 'grain_mismatch', 'stale_evidence', 'metric_definition_conflict', 'unit_conflict', 'currency_conflict', 'missing_provenance'])
  const status: CompatibilityStatus = issues.some(issue => incompatibleCodes.has(issue.code))
    ? 'incompatible'
    : issues.length ? 'insufficient_evidence' : 'compatible'
  const first = evidence[0]
  return {
    status, domains, evidenceIds,
    period: first && status === 'compatible' ? { start: first.periodStart, end: first.periodEnd, timeZone: first.timeZone } : null,
    grain: first && status === 'compatible' ? first.grain : null,
    issues,
  }
}