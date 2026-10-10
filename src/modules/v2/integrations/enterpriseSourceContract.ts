import type { V2ScopeContext } from '../domain/scope'

/**
 * EIF-01 source contract. This describes a governed, read-only source; it is
 * not a connector, credential store, data fetcher, or execution mechanism.
 * Operational systems remain authoritative for their records.
 */
export type EnterpriseDataDomain =
  | 'finance'
  | 'procurement'
  | 'inventory'
  | 'fleet'
  | 'construction'
  | 'billing'
  | 'budgets'
  | 'documents'
  | 'other'

export type EnterpriseSourceProtocol = 'api' | 'webhook' | 'file' | 'database' | 'manual'
export type EnterpriseSourceStatus = 'draft' | 'active' | 'paused' | 'revoked'

export interface EnterpriseSourceContract {
  id: string
  organizationId: string
  workspaceId: string
  name: string
  provider: string
  domain: EnterpriseDataDomain
  protocol: EnterpriseSourceProtocol
  /** EIF-01 intentionally supports reads only. Mutations belong to source systems. */
  accessMode: 'read_only'
  status: EnterpriseSourceStatus
  /** Named data capabilities, e.g. invoices.read or inventory_movements.read. */
  capabilities: readonly string[]
  /** Opaque secret-manager reference only; never a credential or token. */
  credentialRef?: string
  freshness: {
    maxAgeSeconds: number
  }
}

export interface EnterpriseSourceRecord {
  sourceRecordId: string
  /** Optional source-native update timestamp. It is not substituted for observedAt. */
  sourceUpdatedAt?: string
  value: Record<string, unknown>
  provenance: {
    sourceId: string
    sourceSystem: string
    retrievedAt: string
    locator?: string
  }
}

export interface EnterpriseSourceSnapshot {
  sourceId: string
  organizationId: string
  workspaceId: string
  observedAt: string
  records: readonly EnterpriseSourceRecord[]
}

export type EnterpriseSourceIssueCode =
  | 'invalid_contract'
  | 'scope_mismatch'
  | 'source_not_active'
  | 'write_access_forbidden'
  | 'invalid_capabilities'
  | 'invalid_freshness_policy'
  | 'invalid_observation_time'
  | 'stale_snapshot'
  | 'future_snapshot'
  | 'snapshot_source_mismatch'
  | 'duplicate_source_record'
  | 'invalid_record_provenance'

export interface EnterpriseSourceValidation {
  valid: boolean
  issues: Array<{ code: EnterpriseSourceIssueCode; message: string; recordId?: string }>
}

const VALID_DOMAINS: readonly string[] = [
  'finance', 'procurement', 'inventory', 'fleet', 'construction',
  'billing', 'budgets', 'documents', 'other',
]
const VALID_PROTOCOLS: readonly string[] = ['api', 'webhook', 'file', 'database', 'manual']
const VALID_STATUSES: readonly string[] = ['draft', 'active', 'paused', 'revoked']

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseTime(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function result(issues: EnterpriseSourceValidation['issues']): EnterpriseSourceValidation {
  return { valid: issues.length === 0, issues }
}

/**
 * Deterministic contract validation. Authorization must still be enforced by
 * the source adapter/server boundary; this check is defense in depth.
 */
export function validateEnterpriseSourceContract(
  contract: EnterpriseSourceContract,
  context: V2ScopeContext,
): EnterpriseSourceValidation {
  const issues: EnterpriseSourceValidation['issues'] = []
  const add = (code: EnterpriseSourceIssueCode, message: string) => issues.push({ code, message })

  if (
    !isNonBlank(contract.id) ||
    !isNonBlank(contract.organizationId) ||
    !isNonBlank(contract.workspaceId) ||
    !isNonBlank(contract.name) ||
    !isNonBlank(contract.provider)
  ) {
    add('invalid_contract', 'Source identity, organization, workspace, name, and provider are required.')
  }

  if (contract.organizationId !== context.organizationId || contract.workspaceId !== context.workspaceId) {
    add('scope_mismatch', 'Source is outside the active organization and workspace scope.')
  }

  if (!VALID_DOMAINS.includes(contract.domain) || !VALID_PROTOCOLS.includes(contract.protocol) || !VALID_STATUSES.includes(contract.status)) {
    add('invalid_contract', 'Source domain, protocol, or lifecycle status is invalid.')
  }

  if (contract.accessMode !== 'read_only') {
    add('write_access_forbidden', 'Enterprise source contracts must be read-only.')
  }

  if (
    !Array.isArray(contract.capabilities) ||
    contract.capabilities.length === 0 ||
    contract.capabilities.some(capability => !isNonBlank(capability) || !capability.endsWith('.read')) ||
    new Set(contract.capabilities).size !== contract.capabilities.length
  ) {
    add('invalid_capabilities', 'At least one unique read-only capability ending in .read is required.')
  }

  if (!Number.isFinite(contract.freshness?.maxAgeSeconds) || contract.freshness.maxAgeSeconds <= 0) {
    add('invalid_freshness_policy', 'Freshness maxAgeSeconds must be a positive finite number.')
  }

  if (contract.credentialRef !== undefined && !isNonBlank(contract.credentialRef)) {
    add('invalid_contract', 'credentialRef, when present, must be a non-empty opaque reference.')
  }

  return result(issues)
}

/**
 * Validate a read result before it can be supplied to enterprise reasoning.
 * This function does not fetch data, authorize access, or persist anything.
 */
export function validateEnterpriseSourceSnapshot(
  contract: EnterpriseSourceContract,
  context: V2ScopeContext,
  snapshot: EnterpriseSourceSnapshot,
  options: { now?: string } = {},
): EnterpriseSourceValidation {
  const contractValidation = validateEnterpriseSourceContract(contract, context)
  const issues: EnterpriseSourceValidation['issues'] = [...contractValidation.issues]
  const add = (code: EnterpriseSourceIssueCode, message: string, recordId?: string) =>
    issues.push({ code, message, ...(recordId ? { recordId } : {}) })

  if (contract.status !== 'active') {
    add('source_not_active', 'Only an active enterprise source may provide intelligence evidence.')
  }

  if (
    snapshot.sourceId !== contract.id ||
    snapshot.organizationId !== context.organizationId ||
    snapshot.workspaceId !== context.workspaceId ||
    snapshot.organizationId !== contract.organizationId ||
    snapshot.workspaceId !== contract.workspaceId
  ) {
    add('snapshot_source_mismatch', 'Snapshot source and scope must match the validated source contract and active context.')
  }

  const now = parseTime(options.now ?? new Date().toISOString())
  const observedAt = parseTime(snapshot.observedAt)
  if (now === null || observedAt === null) {
    add('invalid_observation_time', 'Snapshot observedAt and validation time must be valid timestamps.')
  } else {
    if (observedAt > now) add('future_snapshot', 'Snapshot observation time cannot be in the future.')
    if (now - observedAt > contract.freshness.maxAgeSeconds * 1000) {
      add('stale_snapshot', 'Snapshot exceeds the source contract freshness limit.')
    }
  }

  const seen = new Set<string>()
  for (const record of snapshot.records) {
    if (!isNonBlank(record.sourceRecordId) || seen.has(record.sourceRecordId)) {
      add('duplicate_source_record', 'Source record identifiers must be present and unique within a snapshot.', record.sourceRecordId)
    }
    if (isNonBlank(record.sourceRecordId)) seen.add(record.sourceRecordId)

    const retrievedAt = parseTime(record.provenance?.retrievedAt ?? '')
    if (
      record.provenance?.sourceId !== contract.id ||
      record.provenance?.sourceSystem !== contract.provider ||
      retrievedAt === null ||
      retrievedAt > (observedAt ?? -Infinity) ||
      !record.value ||
      typeof record.value !== 'object' ||
      Array.isArray(record.value)
    ) {
      add('invalid_record_provenance', 'Every record must retain matching source identity, a valid retrieval timestamp, and a structured value.', record.sourceRecordId)
    }

    if (record.sourceUpdatedAt !== undefined && parseTime(record.sourceUpdatedAt) === null) {
      add('invalid_record_provenance', 'Source-native update timestamps must be valid when supplied.', record.sourceRecordId)
    }
  }

  return result(issues)
}
