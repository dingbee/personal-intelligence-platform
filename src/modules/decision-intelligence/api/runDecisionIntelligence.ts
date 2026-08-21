import { hasFeature } from '@/modules/plans/api/plans'
import { DECISION_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/decisionIntelligence'
import { buildDecisionContext } from '@/modules/decision-intelligence/api/buildDecisionContext'
import { formatDecisionContextForPrompt } from '@/modules/decision-intelligence/api/formatDecisionContextForPrompt'
import { parseDecisionResponse } from '@/modules/decision-intelligence/api/parseDecisionResponse'
import { validateDecision } from '@/modules/decision-intelligence/api/validateDecision'
import { computeWeightedScores } from '@/modules/decision-intelligence/api/computeWeightedScores'
import { computeSensitivity } from '@/modules/decision-intelligence/api/computeSensitivity'
import { computeConfidence } from '@/modules/decision-intelligence/api/computeConfidence'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { beginIntelligenceOperation, runOperationAiCall, OperationBudgetExhaustedError, IntelligenceOperationQuotaDeniedError } from '@/shared/lib/intelligenceOperations'
import { recordDecisionIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordDecisionIntelligenceRecord'
import type { PlanDerivedDecisionContext } from '@/modules/decision-intelligence/api/adaptPlanForDecisionContext'
import type { Decision, DecisionStatus } from '@/modules/decision-intelligence/decision'

export interface DecisionIntelligenceOutcome {
  decision: Decision
}

function emptyDecision(question: string, objective: string | null, workspaceId: string | null, overrides: Partial<Decision> & { status: DecisionStatus }): Decision {
  return {
    id: crypto.randomUUID(),
    title: question.trim() ? `Decision: ${question.trim().slice(0, 80)}` : 'Untitled decision',
    question,
    objective,
    alternatives: [],
    criteria: [],
    evaluations: [],
    weightedScores: [],
    recommendedAlternativeId: null,
    confidence: null,
    rationale: null,
    tradeoffs: [],
    risks: [],
    assumptions: [],
    constraints: [],
    unknowns: [],
    consequences: [],
    sensitivity: [],
    nextAction: null,
    contextEvidence: [],
    datasetInvestigation: null,
    provisional: false,
    provisionalReason: null,
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Decision Intelligence's orchestration function — the sprint brief's
 * own flow (Phase 9), in one linear pass, mirroring Planning
 * Intelligence's own runPlanningIntelligence.ts exactly: buildContext ->
 * (prompt, inside module.ts's registered template) -> one runCapability
 * call -> parse -> deterministically compute weighted scores -> validate
 * -> deterministically compute sensitivity -> derive confidence/
 * provisional -> return a typed Decision. No step loop: Decision has no
 * dataset or evidence to iteratively investigate, only already-assembled
 * context to reason over once.
 *
 * Operation Budget Foundation — opens exactly ONE IntelligenceOperation
 * (operationType 'decision_intelligence'), consistent with every
 * sibling engine.
 */
export async function runDecisionIntelligence(params: {
  question: string
  objective?: string | null
  userConstraints?: string[]
  userId: string
  workspaceId: string | null
  chain: string[]
  plan?: PlanDerivedDecisionContext | null
  /** Optional single-document scope — when set and that document has a real structured dataset, buildDecisionContext.ts delegates to Analysis Intelligence for a deterministic, dataset-grounded number (see that function's own doc comment). Mirrors Research Intelligence's identical `documentId` parameter. */
  documentId?: string | null
}): Promise<DecisionIntelligenceOutcome> {
  const { question, objective = null, userConstraints = [], userId, workspaceId, chain, plan = null, documentId = null } = params

  if (!(await hasFeature(userId, DECISION_INTELLIGENCE_FEATURE_KEY))) {
    throw new Error('Decision Intelligence requires an upgraded plan.')
  }

  if (!question.trim()) {
    return { decision: emptyDecision(question, objective, workspaceId, { status: 'declined', declineReason: 'A decision question is required.' }) }
  }

  let operation
  try {
    operation = await beginIntelligenceOperation({ operationType: 'decision_intelligence', userId, workspaceId })
  } catch (err) {
    if (err instanceof IntelligenceOperationQuotaDeniedError) {
      return { decision: emptyDecision(question, objective, workspaceId, { status: 'failed', declineReason: err.message }) }
    }
    throw err
  }

  const context = await buildDecisionContext({ question, objective, userConstraints, userId, workspaceId, plan, documentId, chain, operation })
  const decisionSummary = formatDecisionContextForPrompt(context)

  let call
  let providerId: string
  try {
    ;({ result: call, providerId } = await runOperationAiCall(operation, chain, (candidateId) =>
      runCapability({
        capabilityId: 'decision-generate-recommendation',
        variables: { decisionSummary },
        userId,
        workspaceId,
        providerId: candidateId,
        requestedProviderId: chain[0],
        operationId: operation.operationId,
        operationType: operation.operationType,
      }),
    ))
  } catch (err) {
    if (err instanceof OperationBudgetExhaustedError) {
      return { decision: emptyDecision(question, objective, workspaceId, { status: 'failed', budgetExhausted: true, declineReason: 'Operation budget exhausted before decision analysis could complete.' }) }
    }
    throw err
  }

  operation.status = 'completed'

  const parsed = parseDecisionResponse(call.content, context.relevantEvidence)

  if (parsed.status === 'declined') {
    return { decision: emptyDecision(question, objective, workspaceId, { status: 'declined', declineReason: parsed.reason, contextEvidence: context.relevantEvidence, datasetInvestigation: context.datasetInvestigation }) }
  }
  if (parsed.status === 'invalid') {
    return {
      decision: emptyDecision(question, objective, workspaceId, {
        status: 'failed',
        generationFailed: true,
        declineReason: parsed.reason,
        contextEvidence: context.relevantEvidence,
        datasetInvestigation: context.datasetInvestigation,
      }),
    }
  }

  const fields = parsed.decision
  const weightedScores = computeWeightedScores(fields.criteria, fields.alternatives, fields.evaluations)
  const validationIssues = validateDecision({ question, objective, fields, weightedScores, contextEvidenceCount: context.relevantEvidence.length })
  const sensitivity = computeSensitivity({ criteria: fields.criteria, alternatives: fields.alternatives, evaluations: fields.evaluations, weightedScores, assumptions: fields.assumptions, unknowns: fields.unknowns })
  const { confidence, provisional, provisionalReason } = computeConfidence({
    declaredConfidence: fields.confidence,
    recommendedAlternativeId: fields.recommendedAlternativeId,
    evaluations: fields.evaluations,
    contextEvidenceCount: context.relevantEvidence.length,
    unknowns: fields.unknowns,
  })

  const decision: Decision = {
    id: crypto.randomUUID(),
    title: fields.title,
    question,
    objective,
    status: 'complete',
    alternatives: fields.alternatives,
    criteria: fields.criteria,
    evaluations: fields.evaluations,
    weightedScores,
    recommendedAlternativeId: fields.recommendedAlternativeId,
    confidence,
    rationale: fields.rationale,
    tradeoffs: fields.tradeoffs,
    risks: fields.risks,
    assumptions: fields.assumptions,
    constraints: fields.constraints,
    unknowns: fields.unknowns,
    consequences: fields.consequences,
    sensitivity,
    nextAction: fields.nextAction,
    contextEvidence: context.relevantEvidence,
    datasetInvestigation: context.datasetInvestigation,
    provisional,
    provisionalReason,
    validationIssues,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId,
    createdAt: new Date().toISOString(),
  }

  // Intelligence Ledger — best-effort, never throws, never alters this
  // function's own decision (see recordDecisionIntelligenceRecord.ts).
  await recordDecisionIntelligenceRecord({ decision, workspaceId, operationId: operation.operationId, providerId })

  return { decision }
}
