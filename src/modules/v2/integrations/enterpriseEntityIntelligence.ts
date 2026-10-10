import type { V2ScopeContext } from '../domain/scope'

/**
 * EIF-02 enterprise identity contract.
 *
 * This is a deterministic identity/reconciliation boundary, not a new graph,
 * persistence layer, authorization engine, or automatic merge mechanism.
 * Existing knowledge nodes and the Intelligence Ledger remain authoritative
 * for graph evidence and durable history.
 */
export const ENTERPRISE_ENTITY_TYPES = [
  'organization',
  'business_unit',
  'person',
  'supplier',
  'customer',
  'property',
  'product',
  'invoice',
  'payment',
  'purchase_order',
  'asset',
  'vehicle',
  'project',
  'budget',
  'account',
  'other',
] as const

export type EnterpriseEntityType = (typeof ENTERPRISE_ENTITY_TYPES)[number]

export interface EnterpriseEntityIdentifier {
  /** Namespace is source/domain-defined, e.g. vat_id, supplier_code, invoice_number. */
  namespace: string
  /** Preserve the source value; matching uses conservative normalization. */
  value: string
}

export interface EnterpriseEntityEvidenceRef {
  sourceId: string
  sourceRecordId: string
  sourceSystem: string
  observedAt: string
  locator?: string
}

export interface EnterpriseEntityIdentity {
  /** Existing canonical identity reference, normally mapped to an existing graph node. */
  id: string
  organizationId: string
  workspaceId: string
  entityType: EnterpriseEntityType
  canonicalName: string
  aliases: readonly string[]
  identifiers: readonly EnterpriseEntityIdentifier[]
  evidence: readonly EnterpriseEntityEvidenceRef[]
}

export interface EnterpriseEntityObservation {
  organizationId: string
  workspaceId: string
  entityType: EnterpriseEntityType
  name: string
  aliases?: readonly string[]
  identifiers: readonly EnterpriseEntityIdentifier[]
  evidence: EnterpriseEntityEvidenceRef
}

export type EnterpriseEntityIssueCode =
  | 'invalid_observation'
  | 'scope_mismatch'
  | 'invalid_entity_type'
  | 'invalid_identifier'
  | 'invalid_evidence'
  | 'invalid_candidate'

export interface EnterpriseEntityValidation {
  valid: boolean
  issues: Array<{ code: EnterpriseEntityIssueCode; message: string }>
}

export type EnterpriseEntityReconciliation =
  | { outcome: 'rejected'; reason: 'invalid_observation' | 'scope_mismatch' | 'invalid_candidate'; issues: EnterpriseEntityValidation['issues'] }
  | { outcome: 'new_entity'; normalizedName: string; explanation: string }
  | { outcome: 'matched'; entityId: string; basis: 'exact_identifier'; explanation: string }
  | { outcome: 'review_required'; candidateEntityIds: string[]; basis: 'exact_name' | 'ambiguous_identifier'; explanation: string }
  | { outcome: 'conflict'; candidateEntityIds: string[]; reason: 'identifier_collision' | 'entity_type_mismatch' | 'ambiguous_identity'; explanation: string }

const ENTITY_TYPES: readonly string[] = ENTERPRISE_ENTITY_TYPES

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Conservative normalization: punctuation is retained for identifiers. */
export function normalizeEnterpriseIdentifier(namespace: string, value: string): string {
  return `${namespace.trim().toLowerCase()}:${value.trim().toLowerCase().replace(/\\s+/g, ' ')}`
}

/** Mirrors existing exact-title normalization; deliberately does not fuzzy-match. */
export function normalizeEnterpriseEntityName(value: string): string {
  return value.trim().replace(/[^\\w\\s]/g, ' ').replace(/\\s+/g, ' ').trim().toLowerCase()
}

function validIdentifiers(identifiers: readonly EnterpriseEntityIdentifier[]): boolean {
  if (!Array.isArray(identifiers)) return false
  const keys = new Set<string>()
  for (const identifier of identifiers) {
    if (!identifier || !isNonBlank(identifier.namespace) || !isNonBlank(identifier.value)) return false
    const key = normalizeEnterpriseIdentifier(identifier.namespace, identifier.value)
    if (keys.has(key)) return false
    keys.add(key)
  }
  return true
}

function validEvidence(evidence: EnterpriseEntityEvidenceRef): boolean {
  if (!evidence || !isNonBlank(evidence.sourceId) || !isNonBlank(evidence.sourceRecordId) || !isNonBlank(evidence.sourceSystem)) return false
  const observed = Date.parse(evidence.observedAt)
  return Number.isFinite(observed) && (evidence.locator === undefined || isNonBlank(evidence.locator))
}

export function validateEnterpriseEntityObservation(
  observation: EnterpriseEntityObservation,
  context: V2ScopeContext,
): EnterpriseEntityValidation {
  const issues: EnterpriseEntityValidation['issues'] = []
  const add = (code: EnterpriseEntityIssueCode, message: string) => issues.push({ code, message })

  if (!observation || !isNonBlank(observation.organizationId) || !isNonBlank(observation.workspaceId) || !isNonBlank(observation.name)) {
    add('invalid_observation', 'Organization, Business Space, and entity name are required.')
    return { valid: false, issues }
  }

  if (observation.organizationId !== context.organizationId || !context.workspaceId || observation.workspaceId !== context.workspaceId) {
    add('scope_mismatch', 'Entity observation is outside the active organization and Business Space.')
  }
  if (!ENTITY_TYPES.includes(observation.entityType)) add('invalid_entity_type', 'Entity type is not supported.')
  if (!validIdentifiers(observation.identifiers)) add('invalid_identifier', 'Identifiers must have unique non-empty namespaces and values.')
  if (!validEvidence(observation.evidence)) add('invalid_evidence', 'Source evidence requires source identity, record identity, source system, and a valid observation timestamp.')

  return { valid: issues.length === 0, issues }
}

function validateCandidate(entity: EnterpriseEntityIdentity): boolean {
  return Boolean(
    entity &&
    isNonBlank(entity.id) &&
    isNonBlank(entity.organizationId) &&
    isNonBlank(entity.workspaceId) &&
    ENTITY_TYPES.includes(entity.entityType) &&
    isNonBlank(entity.canonicalName) &&
    Array.isArray(entity.aliases) &&
    entity.aliases.every(isNonBlank) &&
    validIdentifiers(entity.identifiers) &&
    Array.isArray(entity.evidence) &&
    entity.evidence.every(validEvidence),
  )
}

function identifierKeys(identifiers: readonly EnterpriseEntityIdentifier[]): Set<string> {
  return new Set(identifiers.map(item => normalizeEnterpriseIdentifier(item.namespace, item.value)))
}

function sharedIdentifiers(
  left: readonly EnterpriseEntityIdentifier[],
  right: readonly EnterpriseEntityIdentifier[],
): string[] {
  const rightKeys = identifierKeys(right)
  return [...identifierKeys(left)].filter(key => rightKeys.has(key))
}

function identifierNamespaceConflicts(
  left: readonly EnterpriseEntityIdentifier[],
  right: readonly EnterpriseEntityIdentifier[],
): boolean {
  const rightByNamespace = new Map(right.map(item => [item.namespace.trim().toLowerCase(), item.value.trim().toLowerCase().replace(/\\s+/g, ' ')]))
  return left.some(item => {
    const namespace = item.namespace.trim().toLowerCase()
    const otherValue = rightByNamespace.get(namespace)
    return otherValue !== undefined && otherValue !== item.value.trim().toLowerCase().replace(/\\s+/g, ' ')
  })
}

/**
 * Reconcile an observation against only the candidate identities supplied by
 * an already-authorized caller. Out-of-scope candidates are ignored and never
 * returned. Exact identifiers can identify a candidate; names alone require
 * review. No result merges entities or writes to operational systems.
 */
export function reconcileEnterpriseEntity(
  observation: EnterpriseEntityObservation,
  candidates: readonly EnterpriseEntityIdentity[],
  context: V2ScopeContext,
): EnterpriseEntityReconciliation {
  const validation = validateEnterpriseEntityObservation(observation, context)
  if (!validation.valid) {
    const scopeOnly = validation.issues.some(issue => issue.code === 'scope_mismatch')
    return {
      outcome: 'rejected',
      reason: scopeOnly ? 'scope_mismatch' : 'invalid_observation',
      issues: validation.issues,
    }
  }

  const inScopeCandidates = candidates.filter(candidate =>
    candidate.organizationId === context.organizationId &&
    candidate.workspaceId === context.workspaceId,
  )

  if (inScopeCandidates.some(candidate => !validateCandidate(candidate))) {
    return {
      outcome: 'rejected',
      reason: 'invalid_candidate',
      issues: [{ code: 'invalid_candidate', message: 'At least one in-scope candidate has an invalid identity contract.' }],
    }
  }

  const incomingKeys = identifierKeys(observation.identifiers)
  const identifierMatches = inScopeCandidates.filter(candidate =>
    sharedIdentifiers(observation.identifiers, candidate.identifiers).length > 0,
  )

  if (identifierMatches.length > 1) {
    return {
      outcome: 'conflict',
      reason: 'ambiguous_identity',
      candidateEntityIds: identifierMatches.map(entity => entity.id),
      explanation: 'The same namespaced identifier is attached to multiple in-scope identities; no merge is permitted.',
    }
  }

  if (identifierMatches.length === 1) {
    const candidate = identifierMatches[0]!
    if (candidate.entityType !== observation.entityType) {
      return {
        outcome: 'conflict',
        reason: 'entity_type_mismatch',
        candidateEntityIds: [candidate.id],
        explanation: 'An exact identifier points to an identity of a different entity type; human review is required.',
      }
    }
    if (identifierNamespaceConflicts(observation.identifiers, candidate.identifiers)) {
      return {
        outcome: 'conflict',
        reason: 'identifier_collision',
        candidateEntityIds: [candidate.id],
        explanation: 'An exact identifier matched, but another shared identifier namespace has a conflicting value.',
      }
    }
    return {
      outcome: 'matched',
      entityId: candidate.id,
      basis: 'exact_identifier',
      explanation: 'A namespaced identifier matched exactly within the active organization and Business Space.',
    }
  }

  const normalizedName = normalizeEnterpriseEntityName(observation.name)
  const nameMatches = inScopeCandidates.filter(candidate =>
    candidate.entityType === observation.entityType &&
    [candidate.canonicalName, ...candidate.aliases].some(name => normalizeEnterpriseEntityName(name) === normalizedName),
  )

  if (nameMatches.length > 0) {
    const conflicting = nameMatches.filter(candidate => identifierNamespaceConflicts(observation.identifiers, candidate.identifiers))
    if (conflicting.length > 0) {
      return {
        outcome: 'conflict',
        reason: 'identifier_collision',
        candidateEntityIds: conflicting.map(entity => entity.id),
        explanation: 'The name matches an existing identity but a shared identifier namespace has a different value.',
      }
    }
    return {
      outcome: 'review_required',
      candidateEntityIds: nameMatches.map(entity => entity.id),
      basis: 'exact_name',
      explanation: 'An exact normalized name or alias matched, but name-only evidence is insufficient for automatic identity resolution.',
    }
  }

  // Prevent an entity-type collision from being silently treated as a new entity.
  const crossTypeNameMatches = inScopeCandidates.filter(candidate =>
    [candidate.canonicalName, ...candidate.aliases].some(name => normalizeEnterpriseEntityName(name) === normalizedName),
  )
  if (crossTypeNameMatches.length > 0) {
    return {
      outcome: 'conflict',
      reason: 'entity_type_mismatch',
      candidateEntityIds: crossTypeNameMatches.map(entity => entity.id),
      explanation: 'The same normalized name exists under a different entity type; identity must be reviewed.',
    }
  }

  // Keep this explicit to make it clear identifiers were evaluated without
  // treating their presence as a match unless namespace and value both agree.
  void incomingKeys
  return {
    outcome: 'new_entity',
    normalizedName,
    explanation: 'No exact identifier or normalized-name candidate exists in the authorized candidate set. Persistence/creation is a separate governed operation.',
  }
}
