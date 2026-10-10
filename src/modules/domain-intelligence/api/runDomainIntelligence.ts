import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { writeDomainIntelligenceRecord } from '@/modules/intelligence-ledger/api/createDomainIntelligenceRecord'
import { validateDomainIntelligenceOutput, type DomainIntelligenceOutput, type IntelligenceDomainKey, type IntelligencePersistenceOutcome } from '@/modules/intelligence-ledger/domainContract'

export interface RunDomainIntelligenceParams {
  domain: IntelligenceDomainKey
  question: string
  userId: string
  workspaceId: string | null
  /** Must be sourced by the caller from the existing authorized retrieval path. */
  context?: string | null
  objective?: string | null
  constraints?: string | null
  providerId?: string
  conversationId?: string | null
  operationId?: string | null
  operationType?: string | null
}

export interface RunDomainIntelligenceResult {
  domain: IntelligenceDomainKey
  output: DomainIntelligenceOutput
  model: string | null
  persistence: IntelligencePersistenceOutcome
}

function parseDomainOutput(raw: string, domain: IntelligenceDomainKey): DomainIntelligenceOutput {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  let parsed: unknown
  try {
    parsed = JSON.parse(fenced ? fenced[1]!.trim() : trimmed)
  } catch {
    throw new Error('Domain intelligence returned invalid JSON; no record was persisted.')
  }

  if (!validateDomainIntelligenceOutput(parsed, domain)) {
    throw new Error('Domain intelligence output failed IF-02 contract validation; no record was persisted.')
  }
  if (parsed.recommendations.some(recommendation => recommendation.requiresApproval !== true)) {
    throw new Error('Domain intelligence recommendations must require approval; no record was persisted.')
  }
  return parsed
}

/**
 * Execute one registered domain capability through the shared capability
 * boundary, validate the IF-02 output contract, then persist through the
 * canonical ledger RPC. Context must already have been authorized by the
 * caller's normal retrieval path; this function does not fetch or broaden
 * access to source records. Persistence failure is returned explicitly and
 * does not masquerade as a durable record or erase the valid analysis.
 */
export async function runDomainIntelligence(params: RunDomainIntelligenceParams): Promise<RunDomainIntelligenceResult> {
  const { domain, question, userId, workspaceId, context = null, objective = null, constraints = null,
    providerId, conversationId = null, operationId = null, operationType = null } = params

  if (!question.trim()) throw new Error('A domain intelligence question is required.')

  const result = await runCapability({
    capabilityId: `domain-${domain}-assessment`,
    variables: {
      question,
      objective: objective ?? '(none supplied)',
      constraints: constraints ?? '(none supplied)',
      context: context ?? '(no authorized context supplied)',
    },
    userId,
    workspaceId,
    ...(providerId ? { providerId } : {}),
    ...(operationId ? { operationId } : {}),
    ...(operationType ? { operationType } : {}),
  })

  const output = parseDomainOutput(result.content, domain)
  const persistence = await writeDomainIntelligenceRecord({
    domainKey: domain,
    workspaceId,
    recordType: 'analysis',
    summary: `${domain[0]!.toUpperCase() + domain.slice(1)} Intelligence: ${question.trim()}`,
    structuredOutput: output,
    conversationId,
    operationId,
    providerId: providerId ?? null,
  })

  return { domain, output, model: result.model, persistence }
}
