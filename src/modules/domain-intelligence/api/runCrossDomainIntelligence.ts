import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { CROSS_DOMAIN_CAPABILITY_ID } from '@/modules/domain-intelligence/crossDomainModule'
import { evaluateCrossDomainCompatibility, type CrossDomainCompatibilityResult, type CrossDomainEvidenceDescriptor } from '@/modules/domain-intelligence/crossDomainCompatibility'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import type { IntelligenceEvidenceKind, IntelligenceDomainKey } from '@/modules/intelligence-ledger/domainContract'

interface CrossDomainOutputEvidence { id: string; kind: IntelligenceEvidenceKind; statement: string; sourceRef: string; confidence: number | null }
interface CrossDomainOutput {
  schemaVersion: 1
  crossDomain: true
  domains: IntelligenceDomainKey[]
  evidence: CrossDomainOutputEvidence[]
  findings: Array<{ id: string; statement: string; evidenceIds: string[] }>
  recommendations: Array<{ id: string; statement: string; evidenceIds: string[]; requiresApproval: true }>
  metadata?: Record<string, unknown>
}

export interface RunCrossDomainIntelligenceParams {
  question: string
  userId: string
  workspaceId: string | null
  /** Must be fetched through existing authorization-aware retrieval before calling this function. */
  evidence: readonly CrossDomainEvidenceDescriptor[]
  /** Context derived only from the same authorized evidence set. */
  evidenceContext: string
  providerId?: string
  operationId?: string | null
}

export type RunCrossDomainIntelligenceResult =
  | { status: 'incompatible' | 'insufficient_evidence'; compatibility: CrossDomainCompatibilityResult }
  | { status: 'completed'; compatibility: CrossDomainCompatibilityResult; output: CrossDomainOutput; model: string | null; persistence: { status: 'persisted'; recordId: string } | { status: 'not_persisted' } }

function parseOutput(raw: string, evidence: readonly CrossDomainEvidenceDescriptor[], expectedDomains: IntelligenceDomainKey[]): CrossDomainOutput {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  let parsed: unknown
  try { parsed = JSON.parse(fenced ? fenced[1]!.trim() : trimmed) }
  catch { throw new Error('Cross-domain output is invalid JSON; no record was persisted.') }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Cross-domain output failed contract validation; no record was persisted.')
  const output = parsed as Record<string, unknown>
  if (output.schemaVersion !== 1 || output.crossDomain !== true || !Array.isArray(output.domains) || !Array.isArray(output.evidence) || !Array.isArray(output.findings) || !Array.isArray(output.recommendations)) {
    throw new Error('Cross-domain output failed contract validation; no record was persisted.')
  }
  if ([...output.domains].sort().join('|') !== expectedDomains.slice().sort().join('|')) throw new Error('Cross-domain output domain set mismatch; no record was persisted.')
  const sources = new Map(evidence.map(item => [item.evidenceId, item.sourceRef]))
  const seen = new Set<string>()
  for (const rawEvidence of output.evidence) {
    if (typeof rawEvidence !== 'object' || rawEvidence === null || Array.isArray(rawEvidence)) throw new Error('Cross-domain evidence item is malformed; no record was persisted.')
    const item = rawEvidence as Record<string, unknown>
    if (typeof item.id !== 'string' || seen.has(item.id) || !sources.has(item.id) || typeof item.sourceRef !== 'string' || item.sourceRef !== sources.get(item.id)) {
      throw new Error('Cross-domain evidence contains an unknown ID or altered source reference; no record was persisted.')
    }
    if (!['verified_fact', 'deterministic_calculation', 'assumption', 'hypothesis', 'recommendation'].includes(String(item.kind)) || typeof item.statement !== 'string' || !item.statement.trim()) {
      throw new Error('Cross-domain evidence item failed validation; no record was persisted.')
    }
    if (item.confidence !== null && (typeof item.confidence !== 'number' || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1)) {
      throw new Error('Cross-domain evidence confidence is invalid; no record was persisted.')
    }
    seen.add(item.id)
  }
  for (const collection of [output.findings, output.recommendations]) {
    for (const rawEntry of collection) {
      if (typeof rawEntry !== 'object' || rawEntry === null || Array.isArray(rawEntry)) throw new Error('Cross-domain finding or recommendation is malformed; no record was persisted.')
      const entry = rawEntry as Record<string, unknown>
      if (typeof entry.id !== 'string' || !entry.id.trim() || typeof entry.statement !== 'string' || !entry.statement.trim() || !Array.isArray(entry.evidenceIds) || entry.evidenceIds.length === 0 || !entry.evidenceIds.every(id => typeof id === 'string' && seen.has(id))) {
        throw new Error('Cross-domain finding or recommendation has missing or dangling evidence; no record was persisted.')
      }
      if (collection === output.recommendations && entry.requiresApproval !== true) throw new Error('Cross-domain recommendations must require approval; no record was persisted.')
    }
  }
  return output as unknown as CrossDomainOutput
}

/**
 * Cross-domain execution consumes caller-supplied, already-authorized evidence only.
 * It does not query sources, expand permissions, or normalize incompatible data.
 */
export async function runCrossDomainIntelligence(params: RunCrossDomainIntelligenceParams): Promise<RunCrossDomainIntelligenceResult> {
  const { question, userId, workspaceId, evidence, evidenceContext, providerId, operationId = null } = params
  if (!question.trim()) throw new Error('A cross-domain question is required.')
  const expectedScope = workspaceId ? `workspace:${workspaceId}` : `user:${userId}`
  if (evidence.some(item => item.accessScopeId !== expectedScope)) {
    const compatibility = evaluateCrossDomainCompatibility(evidence)
    return { status: 'incompatible', compatibility: { ...compatibility, status: 'incompatible', issues: [...compatibility.issues, { code: 'scope_mismatch', evidenceIds: evidence.map(item => item.evidenceId), message: 'Evidence scope does not match the caller workspace or personal scope.' }] } }
  }
  const compatibility = evaluateCrossDomainCompatibility(evidence)
  if (compatibility.status !== 'compatible') return { status: compatibility.status, compatibility }
  const domains = compatibility.domains
  const result = await runCapability({
    capabilityId: CROSS_DOMAIN_CAPABILITY_ID, userId, workspaceId,
    ...(providerId ? { providerId } : {}), ...(operationId ? { operationId } : {}),
    variables: { question, compatibility: JSON.stringify(compatibility), evidenceContext: JSON.stringify({ descriptors: evidence, context: evidenceContext }) },
  })
  const output = parseOutput(result.content, evidence, domains)
  const record = await writeIntelligenceRecord({
    workspaceId, recordType: 'analysis', summary: `Cross-domain Intelligence: ${question.trim()}`,
    structuredOutput: output as unknown as Record<string, unknown>, operationId, providerId: providerId ?? null,
  })
  return { status: 'completed', compatibility, output, model: result.model, persistence: record ? { status: 'persisted', recordId: record.id } : { status: 'not_persisted' } }
}