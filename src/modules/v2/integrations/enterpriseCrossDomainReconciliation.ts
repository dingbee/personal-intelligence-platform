import type { V2ScopeContext } from '../domain/scope'

export const EIF_CROSS_DOMAIN_TYPES = [
  'finance', 'procurement', 'sales', 'customers', 'inventory', 'hr',
  'operations', 'compliance', 'projects', 'other',
] as const
export type EIFCrossDomainType = (typeof EIF_CROSS_DOMAIN_TYPES)[number]
export type EIFCrossDomainValueType = 'string' | 'number' | 'boolean' | 'date'
export type EIFCrossDomainValue = string | number | boolean

export interface EIFCrossDomainEvidence {
  sourceId: string
  sourceRecordId: string
  sourceSystem: string
  observedAt: string
  locator?: string
}

export interface EIFCrossDomainObservation {
  organizationId: string
  workspaceId: string
  /** Canonical reference from EIF-02; never inferred from a name here. */
  entityId: string
  domain: EIFCrossDomainType
  /** Stable, domain-neutral attribute key, e.g. supplier.tax_id or invoice.total. */
  attribute: string
  valueType: EIFCrossDomainValueType
  value: EIFCrossDomainValue
  evidence: EIFCrossDomainEvidence
}

export type EIFCrossDomainIssueCode =
  | 'invalid_observation'
  | 'scope_mismatch'
  | 'invalid_domain'
  | 'invalid_value'
  | 'invalid_evidence'
  | 'duplicate_evidence'
  | 'duplicate_observation'

export interface EIFCrossDomainIssue {
  code: EIFCrossDomainIssueCode
  observationIndex?: number
  message: string
}

export interface EIFCrossDomainGroup {
  entityId: string
  attribute: string
  valueType: EIFCrossDomainValueType
  outcome: 'single_source' | 'consistent' | 'conflict'
  /** Normalized values are used for comparison; raw values are not rewritten. */
  distinctValues: EIFCrossDomainValue[]
  domains: EIFCrossDomainType[]
  observations: Array<{
    domain: EIFCrossDomainType
    value: EIFCrossDomainValue
    normalizedValue: string
    evidence: EIFCrossDomainEvidence
  }>
  explanation: string
}

export type EIFCrossDomainReconciliation =
  | { status: 'rejected'; issues: EIFCrossDomainIssue[] }
  | {
      status: 'reconciled'
      scope: { organizationId: string; workspaceId: string }
      generatedAt: string
      groups: EIFCrossDomainGroup[]
      summary: { singleSource: number; consistent: number; conflicts: number }
    }

const VALID_DOMAINS: readonly string[] = EIF_CROSS_DOMAIN_TYPES
const VALID_VALUE_TYPES: readonly string[] = ['string', 'number', 'boolean', 'date']

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeValue(value: EIFCrossDomainValue, type: EIFCrossDomainValueType): string | null {
  if (type === 'string') {
    return typeof value === 'string' && value.trim()
      ? value.trim().replace(/\\s+/g, ' ').toLocaleLowerCase('en-US')
      : null
  }
  if (type === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? String(Object.is(value, -0) ? 0 : value) : null
  }
  if (type === 'boolean') return typeof value === 'boolean' ? String(value) : null
  if (type === 'date') {
    if (typeof value !== 'string' || !value.trim()) return null
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
  }
  return null
}

function validEvidence(evidence: EIFCrossDomainEvidence, nowMs: number): boolean {
  if (!evidence || !nonBlank(evidence.sourceId) || !nonBlank(evidence.sourceRecordId) || !nonBlank(evidence.sourceSystem)) return false
  const observedAt = Date.parse(evidence.observedAt)
  return Number.isFinite(observedAt) && observedAt <= nowMs &&
    (evidence.locator === undefined || nonBlank(evidence.locator))
}

function evidenceKey(evidence: EIFCrossDomainEvidence): string {
  return JSON.stringify([evidence.sourceId, evidence.sourceRecordId, evidence.sourceSystem])
}

function groupKey(observation: EIFCrossDomainObservation): string {
  return JSON.stringify([observation.entityId, observation.attribute.trim().toLowerCase()])
}

/**
 * EIF-05 deterministic cross-domain comparison boundary.
 *
 * Consumes already-authorized, scope-filtered observations that reference
 * EIF-02 canonical entity IDs. It reports consistency and conflicts without
 * choosing a winner, mutating source systems, merging identities, or writing
 * a parallel ledger. Callers remain responsible for authorization before
 * loading observations; operational records remain authoritative.
 */
export function reconcileCrossDomainObservations(
  observations: readonly EIFCrossDomainObservation[],
  context: Pick<V2ScopeContext, 'organizationId' | 'workspaceId'>,
  now = new Date().toISOString(),
): EIFCrossDomainReconciliation {
  const issues: EIFCrossDomainIssue[] = []
  const nowMs = Date.parse(now)
  if (!nonBlank(context?.organizationId) || !nonBlank(context?.workspaceId) || !Number.isFinite(nowMs)) {
    return { status: 'rejected', issues: [{ code: 'invalid_observation', message: 'Valid organization, Business Space, and reconciliation time are required.' }] }
  }

  const seenObservations = new Set<string>()
  const seenEvidence = new Set<string>()
  const valid: Array<{ observation: EIFCrossDomainObservation; normalizedValue: string }> = []

  observations.forEach((observation, index) => {
    if (!observation || !nonBlank(observation.organizationId) || !nonBlank(observation.workspaceId) ||
        !nonBlank(observation.entityId) || !nonBlank(observation.attribute)) {
      issues.push({ code: 'invalid_observation', observationIndex: index, message: 'Organization, Business Space, canonical entity ID, and attribute are required.' })
      return
    }
    if (observation.organizationId !== context.organizationId || observation.workspaceId !== context.workspaceId) {
      issues.push({ code: 'scope_mismatch', observationIndex: index, message: 'Observation is outside the active organization and Business Space.' })
      return
    }
    if (!VALID_DOMAINS.includes(observation.domain)) {
      issues.push({ code: 'invalid_domain', observationIndex: index, message: 'Observation domain is not supported.' })
      return
    }
    if (!VALID_VALUE_TYPES.includes(observation.valueType)) {
      issues.push({ code: 'invalid_value', observationIndex: index, message: 'Observation value type is not supported.' })
      return
    }
    const normalizedValue = normalizeValue(observation.value, observation.valueType)
    if (normalizedValue === null) {
      issues.push({ code: 'invalid_value', observationIndex: index, message: 'Value does not conform to its declared type or is empty.' })
      return
    }
    if (!validEvidence(observation.evidence, nowMs)) {
      issues.push({ code: 'invalid_evidence', observationIndex: index, message: 'Evidence must be attributable and cannot be future-dated.' })
      return
    }

    const key = JSON.stringify([groupKey(observation), observation.domain, observation.valueType, normalizedValue, evidenceKey(observation.evidence)])
    if (seenObservations.has(key)) {
      issues.push({ code: 'duplicate_observation', observationIndex: index, message: 'Duplicate observation would distort cross-domain evidence counts.' })
      return
    }
    const evKey = evidenceKey(observation.evidence)
    if (seenEvidence.has(JSON.stringify([groupKey(observation), evKey]))) {
      issues.push({ code: 'duplicate_evidence', observationIndex: index, message: 'The same source evidence cannot be counted more than once for one entity attribute.' })
      return
    }
    seenObservations.add(key)
    seenEvidence.add(JSON.stringify([groupKey(observation), evKey]))
    valid.push({ observation, normalizedValue })
  })

  // Fail the entire reconciliation rather than silently producing a partial
  // result from malformed, duplicate, or cross-scope inputs.
  if (issues.length) return { status: 'rejected', issues }

  const grouped = new Map<string, typeof valid>()
  for (const entry of valid) {
    const key = groupKey(entry.observation)
    const group = grouped.get(key) ?? []
    group.push(entry)
    grouped.set(key, group)
  }

  const groups: EIFCrossDomainGroup[] = [...grouped.values()].map(entries => {
    const first = entries[0].observation
    const comparisonValues = [...new Set(entries.map(entry => `${entry.observation.valueType}:${entry.normalizedValue}`))]
    const normalizedValues = [...new Set(entries.map(entry => entry.normalizedValue))]
    const domains = [...new Set(entries.map(entry => entry.observation.domain))].sort()
    const outcome = entries.length === 1
      ? 'single_source'
      : comparisonValues.length > 1
        ? 'conflict'
        : 'consistent'
    return {
      entityId: first.entityId,
      attribute: first.attribute.trim().toLowerCase(),
      valueType: first.valueType,
      outcome,
      distinctValues: normalizedValues.map(value => {
        const entry = entries.find(candidate => candidate.normalizedValue === value) as typeof entries[number]
        return entry.observation.value
      }),
      domains,
      observations: entries.map(entry => ({
        domain: entry.observation.domain,
        value: entry.observation.value,
        normalizedValue: entry.normalizedValue,
        evidence: { ...entry.observation.evidence },
      })),
      explanation: outcome === 'single_source'
        ? 'Only one eligible source observation exists; cross-domain consistency is not established.'
        : outcome === 'consistent'
          ? 'Eligible sources agree under deterministic type-specific normalization.'
          : 'Eligible sources disagree. No source is preferred and no operational record is changed.',
    }
  }).sort((a, b) => a.entityId.localeCompare(b.entityId) || a.attribute.localeCompare(b.attribute))

  return {
    status: 'reconciled',
    scope: { organizationId: context.organizationId, workspaceId: context.workspaceId },
    generatedAt: new Date(nowMs).toISOString(),
    groups,
    summary: {
      singleSource: groups.filter(group => group.outcome === 'single_source').length,
      consistent: groups.filter(group => group.outcome === 'consistent').length,
      conflicts: groups.filter(group => group.outcome === 'conflict').length,
    },
  }
}
