import type { V2ControlPlaneStore } from '../control-plane/store'
import type { V2ScopeContext } from '../domain/scope'
import { govern, type GovernanceDecision } from '../workspace/authorization'
import { computeEffectiveConfidence } from '../../ai/memory/computeEffectiveConfidence'

export const ENTERPRISE_MEMORY_KINDS = [
  'fact', 'preference', 'decision', 'project_context', 'process', 'commitment', 'risk', 'lesson',
] as const
export type EnterpriseMemoryKind = (typeof ENTERPRISE_MEMORY_KINDS)[number]
export type EnterpriseMemorySensitivity = 'public' | 'internal' | 'confidential' | 'restricted'
export type EnterpriseMemoryStatus = 'active' | 'archived' | 'revoked'
export type EnterpriseMemoryVisibility = 'workspace' | 'owner_only'

export interface EnterpriseMemoryEvidenceRef {
  sourceId: string
  sourceRecordId: string
  sourceSystem: string
  observedAt: string
  locator?: string
}

export interface EnterpriseKnowledgeMemoryItem {
  id: string
  organizationId: string
  workspaceId: string
  ownerUserId: string | null
  visibility: EnterpriseMemoryVisibility
  kind: EnterpriseMemoryKind
  status: EnterpriseMemoryStatus
  content: string
  sensitivity: EnterpriseMemorySensitivity
  confidence: number | null
  lastReinforcedAt: string | null
  updatedAt: string
  expiresAt: string | null
  evidence: readonly EnterpriseMemoryEvidenceRef[]
}

export interface EnterpriseKnowledgeContextOptions {
  now?: string
  maxItems: number
  maxCharacters: number
  /** Must be derived by trusted server-side policy, never from user-controlled request input. */
  maximumSensitivity: EnterpriseMemorySensitivity
}

export interface EnterpriseKnowledgeContextItem {
  id: string
  kind: EnterpriseMemoryKind
  content: string
  sensitivity: EnterpriseMemorySensitivity
  confidence: number | null
  effectiveConfidence: number | null
  updatedAt: string
  evidence: readonly EnterpriseMemoryEvidenceRef[]
}

export type EnterpriseKnowledgeContextResult =
  | { status: 'invalid_request'; reason: string }
  | { status: 'scope_violation'; reason: string }
  | {
      status: 'ready'
      scope: { organizationId: string; workspaceId: string; userId: string }
      generatedAt: string
      items: EnterpriseKnowledgeContextItem[]
      characterCount: number
      omitted: { inactive: number; expired: number; private: number; sensitivity: number; invalid: number; budget: number }
    }

export type EnterpriseKnowledgeContextResolution =
  | { status: 'denied'; governance: Extract<GovernanceDecision, { allowed: false }> }
  | EnterpriseKnowledgeContextResult

const SENSITIVITY_RANK: Record<EnterpriseMemorySensitivity, number> = {
  public: 0, internal: 1, confidential: 2, restricted: 3,
}
const VALID_KINDS: readonly string[] = ENTERPRISE_MEMORY_KINDS
const VALID_SENSITIVITIES: readonly string[] = Object.keys(SENSITIVITY_RANK)
const VALID_STATUSES: readonly string[] = ['active', 'archived', 'revoked']
const VALID_VISIBILITY: readonly string[] = ['workspace', 'owner_only']

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
function parseTime(value: string): number | null {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}
function validEvidence(evidence: readonly EnterpriseMemoryEvidenceRef[], nowMs: number): boolean {
  if (!Array.isArray(evidence) || evidence.length === 0) return false
  const keys = new Set<string>()
  for (const item of evidence) {
    if (!item || !nonBlank(item.sourceId) || !nonBlank(item.sourceRecordId) || !nonBlank(item.sourceSystem)) return false
    const observedAt = parseTime(item.observedAt)
    if (observedAt === null || observedAt > nowMs) return false
    if (item.locator !== undefined && !nonBlank(item.locator)) return false
    const key = `${item.sourceId}:${item.sourceRecordId}`
    if (keys.has(key)) return false
    keys.add(key)
  }
  return true
}
function validItem(item: EnterpriseKnowledgeMemoryItem, nowMs: number): boolean {
  if (!item || !nonBlank(item.id) || !nonBlank(item.organizationId) || !nonBlank(item.workspaceId)) return false
  if (!VALID_KINDS.includes(item.kind) || !VALID_STATUSES.includes(item.status) || !VALID_VISIBILITY.includes(item.visibility)) return false
  if (!VALID_SENSITIVITIES.includes(item.sensitivity) || !nonBlank(item.content)) return false
  if (item.ownerUserId !== null && !nonBlank(item.ownerUserId)) return false
  if (item.visibility === 'owner_only' && !item.ownerUserId) return false
  if (item.confidence !== null && (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1)) return false
  const updatedAt = parseTime(item.updatedAt)
  if (updatedAt === null || updatedAt > nowMs) return false
  if (item.lastReinforcedAt !== null) {
    const reinforcedAt = parseTime(item.lastReinforcedAt)
    if (reinforcedAt === null || reinforcedAt > nowMs) return false
  }
  if (item.expiresAt !== null && parseTime(item.expiresAt) === null) return false
  return validEvidence(item.evidence, nowMs)
}

/**
 * EIF-04 read-time context composer. It consumes candidates from an existing
 * authorized knowledge/memory/retrieval path; it does not fetch, persist,
 * embed, or execute anything itself. Existing provenance and memory decay
 * semantics remain authoritative.
 */
export function composeEnterpriseKnowledgeContext(
  items: readonly EnterpriseKnowledgeMemoryItem[],
  context: V2ScopeContext,
  options: EnterpriseKnowledgeContextOptions,
): EnterpriseKnowledgeContextResult {
  const now = options.now ?? new Date().toISOString()
  const nowMs = parseTime(now)
  if (!context.organizationId?.trim() || !context.workspaceId?.trim() || !context.userId?.trim()) {
    return { status: 'invalid_request', reason: 'Authenticated user, organization, and Business Space are required.' }
  }
  if (nowMs === null || !Number.isInteger(options.maxItems) || options.maxItems < 1 ||
      !Number.isInteger(options.maxCharacters) || options.maxCharacters < 1 ||
      !VALID_SENSITIVITIES.includes(options.maximumSensitivity)) {
    return { status: 'invalid_request', reason: 'Context time, limits, or sensitivity ceiling is invalid.' }
  }

  const ids = new Set<string>()
  for (const item of items) {
    if (!item || !nonBlank(item.id)) return { status: 'invalid_request', reason: 'Candidate memory has no canonical ID.' }
    if (ids.has(item.id)) return { status: 'scope_violation', reason: 'Candidate loader returned duplicate memory IDs.' }
    ids.add(item.id)
    if (item.organizationId !== context.organizationId || item.workspaceId !== context.workspaceId) {
      return { status: 'scope_violation', reason: 'Candidate loader returned memory outside the active organization and Business Space.' }
    }
  }

  const omitted = { inactive: 0, expired: 0, private: 0, sensitivity: 0, invalid: 0, budget: 0 }
  const eligible: Array<{ item: EnterpriseKnowledgeMemoryItem; effectiveConfidence: number | null }> = []
  for (const item of items) {
    if (!validItem(item, nowMs)) { omitted.invalid += 1; continue }
    if (item.status !== 'active') { omitted.inactive += 1; continue }
    if (item.expiresAt && (parseTime(item.expiresAt) as number) <= nowMs) { omitted.expired += 1; continue }
    if (item.visibility === 'owner_only' && item.ownerUserId !== context.userId) { omitted.private += 1; continue }
    if (SENSITIVITY_RANK[item.sensitivity] > SENSITIVITY_RANK[options.maximumSensitivity]) { omitted.sensitivity += 1; continue }
    const effectiveConfidence = computeEffectiveConfidence({
      confidence: item.confidence,
      last_reinforced_at: item.lastReinforcedAt,
      updated_at: item.updatedAt,
    }, new Date(nowMs))
    eligible.push({ item, effectiveConfidence })
  }

  eligible.sort((a, b) => {
    const confidenceA = a.effectiveConfidence ?? -1
    const confidenceB = b.effectiveConfidence ?? -1
    return confidenceB - confidenceA ||
      (parseTime(b.item.updatedAt) as number) - (parseTime(a.item.updatedAt) as number) ||
      a.item.id.localeCompare(b.item.id)
  })

  const selected: EnterpriseKnowledgeContextItem[] = []
  let characterCount = 0
  for (const candidate of eligible) {
    if (selected.length >= options.maxItems || characterCount + candidate.item.content.length > options.maxCharacters) {
      omitted.budget += 1
      continue
    }
    selected.push({
      id: candidate.item.id,
      kind: candidate.item.kind,
      content: candidate.item.content,
      sensitivity: candidate.item.sensitivity,
      confidence: candidate.item.confidence,
      effectiveConfidence: candidate.effectiveConfidence,
      updatedAt: candidate.item.updatedAt,
      evidence: candidate.item.evidence.map(ref => ({ ...ref })),
    })
    characterCount += candidate.item.content.length
  }

  return {
    status: 'ready',
    scope: { organizationId: context.organizationId, workspaceId: context.workspaceId, userId: context.userId },
    generatedAt: new Date(nowMs).toISOString(),
    items: selected,
    characterCount,
    omitted,
  }
}

export interface ResolveEnterpriseKnowledgeContextParams {
  store: V2ControlPlaneStore
  userId: string
  permission: string
  context: V2ScopeContext
  options: EnterpriseKnowledgeContextOptions
  /** Must use a trusted server-side retrieval path and preserve existing RLS. Called only after governance succeeds. */
  loadCandidates: (scope: { organizationId: string; workspaceId: string; userId: string }) => Promise<readonly EnterpriseKnowledgeMemoryItem[]>
}

/** Governance is checked before existing knowledge/memory candidates are loaded. */
export async function resolveAuthorizedEnterpriseKnowledgeContext(
  params: ResolveEnterpriseKnowledgeContextParams,
): Promise<EnterpriseKnowledgeContextResolution> {
  const { context, userId } = params
  if (!context.workspaceId?.trim() || !context.organizationId.trim() || !userId.trim() || context.userId !== userId) {
    return { status: 'invalid_request', reason: 'Authenticated user and explicit matching organization/Business Space scope are required.' }
  }
  const governance = govern(params.store, {
    userId,
    permission: params.permission,
    context,
    resource: {
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      resourceType: 'enterprise_knowledge',
      action: 'read',
    },
    requestedAutonomy: 'inform',
  })
  if (!governance.allowed) return { status: 'denied', governance }

  const candidates = await params.loadCandidates({
    organizationId: context.organizationId,
    workspaceId: context.workspaceId,
    userId,
  })
  return composeEnterpriseKnowledgeContext(candidates, context, params.options)
}
