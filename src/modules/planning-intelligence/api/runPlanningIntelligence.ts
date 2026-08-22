import { hasFeature } from '@/modules/plans/api/plans'
import { PLANNING_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/planningIntelligence'
import { buildPlanningContext } from '@/modules/planning-intelligence/api/buildPlanningContext'
import { formatPlanningContextForPrompt } from '@/modules/planning-intelligence/api/formatPlanningContextForPrompt'
import { parsePlanningResponse } from '@/modules/planning-intelligence/api/parsePlanningResponse'
import { validatePlan } from '@/modules/planning-intelligence/api/validatePlan'
import { computePlanSchedule } from '@/modules/planning-intelligence/api/computePlanSchedule'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { beginIntelligenceOperation, runOperationAiCall, OperationBudgetExhaustedError, IntelligenceOperationQuotaDeniedError } from '@/shared/lib/intelligenceOperations'
import { recordPlanningIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordPlanningIntelligenceRecord'
import { runDecisionIntelligence } from '@/modules/decision-intelligence/api/runDecisionIntelligence'
import type { Decision } from '@/modules/decision-intelligence/decision'
import type { Plan, PlanDecision, PlanStatus } from '@/modules/planning-intelligence/plan'

export interface PlanningOutcome {
  plan: Plan
}

/** A plan realistically has a small number of genuinely unresolved decision points; capping delegation bounds worst-case cost/latency the same way MAX_WORKSPACE_OBJECTIVES bounds buildPlanningContext.ts's own context assembly. */
const MAX_DELEGATED_DECISIONS = 3

function emptyPlan(objective: string, workspaceId: string | null, overrides: Partial<Plan> & { status: PlanStatus }): Plan {
  return {
    id: crypto.randomUUID(),
    title: objective.trim() ? `Plan: ${objective.trim().slice(0, 80)}` : 'Untitled plan',
    objective,
    description: null,
    currentState: null,
    desiredOutcome: null,
    gapAnalysis: null,
    assumptions: [],
    constraints: [],
    objectives: [],
    workstreams: [],
    milestones: [],
    tasks: [],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
    resources: [],
    deadline: null,
    criticalPath: [],
    contextEvidence: [],
    workspaceId,
    createdAt: new Date().toISOString(),
    validationIssues: [],
    revisionOf: null,
    revisionReason: null,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    ...overrides,
  }
}

/** A short, honest summary of a completed Decision's own recommendation — never the raw Decision object flattened, never a re-derivation of what Decision Intelligence already computed. Null when Decision Intelligence itself resolved nothing (e.g. it also declined to recommend). */
function summarizeDecisionRecommendation(decision: Decision): string | null {
  if (!decision.recommendedAlternativeId) return null
  const alternative = decision.alternatives.find((a) => a.id === decision.recommendedAlternativeId)
  if (!alternative) return null
  return decision.rationale ? `${alternative.title} — ${decision.rationale}` : alternative.title
}

/**
 * Delegates a plan's own genuinely unresolved decision points to the
 * real Decision Intelligence engine — its own IntelligenceOperation, its
 * own quota (decision_intelligence_operations), its own deterministic
 * weighted scoring — rather than trusting the one-shot planning call's
 * own free-text "recommendation" as the source of truth (see
 * PlanDecision.decisionIntelligence's own doc comment in plan.ts). This
 * is Planning Intelligence's I1-I5 integration point for decision-making:
 * reuse, not a second decision engine.
 *
 * Failure is always graceful: if Decision Intelligence isn't entitled,
 * declines, fails, or exhausts its own budget, the plan simply keeps its
 * own fallback recommendation for that decision — nothing here can ever
 * fail plan generation itself.
 */
async function delegateUnresolvedDecisions(params: {
  decisions: PlanDecision[]
  planObjective: string
  userConstraints: string[]
  userId: string
  workspaceId: string | null
  chain: string[]
}): Promise<PlanDecision[]> {
  const { decisions, planObjective, userConstraints, userId, workspaceId, chain } = params
  let delegatedCount = 0

  return Promise.all(
    decisions.map(async (d) => {
      if (!d.unresolved || delegatedCount >= MAX_DELEGATED_DECISIONS) return d
      delegatedCount += 1

      try {
        const optionHints = d.options.length > 0 ? [`Consider these candidate options for this specific decision: ${d.options.map((o) => o.option).join('; ')}`] : []
        const { decision } = await runDecisionIntelligence({
          question: d.decision,
          objective: planObjective,
          userConstraints: [...userConstraints, ...optionHints],
          userId,
          workspaceId,
          chain,
        })
        if (decision.status !== 'complete') return d
        return { ...d, decisionIntelligence: decision, recommendation: summarizeDecisionRecommendation(decision) ?? d.recommendation }
      } catch {
        // Decision Intelligence unavailable/not entitled/etc — honest fallback to the plan's own recommendation, never a failure of plan generation itself.
        return d
      }
    }),
  )
}

/**
 * Planning Intelligence's orchestration function, implementing the
 * brief's own flow in one linear pass — buildPlanningContext ->
 * (buildPlanningPrompt, inside module.ts's registered template) ->
 * executePlanningReasoning (this function's one runCapability call) ->
 * validatePlan -> returnStructuredPlan. Unlike Data/Analysis/Research
 * Intelligence there is no step loop: Planning has no dataset or
 * evidence to iteratively investigate, only already-assembled context to
 * reason over once, so a single bounded call generates the plan itself
 * (see module.ts's doc comment for why this is proportionate, not a
 * shortcut). Genuinely unresolved decision points ARE a second pass —
 * delegated to the real Decision Intelligence engine, its own operation
 * and quota, never rebuilt inline (see delegateUnresolvedDecisions above).
 *
 * Operation Budget Foundation — opens exactly ONE IntelligenceOperation
 * (operationType 'planning_intelligence') for the plan-generation call
 * itself, consistent with every sibling engine. Delegated Decision
 * Intelligence calls open their OWN operation (their own ceiling, their
 * own quota key) — never sharing this one's budget, since
 * runDecisionIntelligence is a peer top-level engine, not a leaf
 * delegate like Analysis Intelligence's parentOperation pattern.
 */
export async function runPlanningIntelligence(params: {
  objective: string
  userConstraints?: string[]
  userId: string
  workspaceId: string | null
  chain: string[]
}): Promise<PlanningOutcome> {
  const { objective, userConstraints = [], userId, workspaceId, chain } = params

  if (!(await hasFeature(userId, PLANNING_INTELLIGENCE_FEATURE_KEY))) {
    throw new Error('Planning Intelligence requires an upgraded plan.')
  }

  if (!objective.trim()) {
    return { plan: emptyPlan(objective, workspaceId, { status: 'declined', declineReason: 'An objective is required to generate a plan.' }) }
  }

  let operation
  try {
    operation = await beginIntelligenceOperation({ operationType: 'planning_intelligence', userId, workspaceId })
  } catch (err) {
    if (err instanceof IntelligenceOperationQuotaDeniedError) {
      return { plan: emptyPlan(objective, workspaceId, { status: 'failed', declineReason: err.message }) }
    }
    throw err
  }

  const context = await buildPlanningContext({ objective, userConstraints, userId, workspaceId })
  const planningSummary = formatPlanningContextForPrompt(context)

  let call
  let providerId: string
  try {
    ;({ result: call, providerId } = await runOperationAiCall(operation, chain, (candidateId) =>
      runCapability({
        capabilityId: 'planning-generate-plan',
        variables: { planningSummary },
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
      return { plan: emptyPlan(objective, workspaceId, { status: 'failed', budgetExhausted: true, declineReason: 'Operation budget exhausted before plan generation could complete.' }) }
    }
    throw err
  }

  operation.status = 'completed'

  const parsed = parsePlanningResponse(call.content)

  if (parsed.status === 'declined') {
    return { plan: emptyPlan(objective, workspaceId, { status: 'declined', declineReason: parsed.reason }) }
  }
  if (parsed.status === 'invalid') {
    return { plan: emptyPlan(objective, workspaceId, { status: 'failed', generationFailed: true, declineReason: parsed.reason }) }
  }

  const validationIssues = validatePlan(objective, parsed.plan)
  const { criticalPath } = computePlanSchedule(parsed.plan.tasks, parsed.plan.resources)
  const decisions = await delegateUnresolvedDecisions({ decisions: parsed.plan.decisions, planObjective: objective, userConstraints, userId, workspaceId, chain })

  const plan: Plan = {
    id: crypto.randomUUID(),
    title: parsed.plan.title,
    objective,
    description: parsed.plan.description,
    status: 'complete',
    currentState: parsed.plan.currentState,
    desiredOutcome: parsed.plan.desiredOutcome,
    gapAnalysis: parsed.plan.gapAnalysis,
    assumptions: parsed.plan.assumptions,
    constraints: parsed.plan.constraints,
    objectives: parsed.plan.objectives,
    workstreams: parsed.plan.workstreams,
    milestones: parsed.plan.milestones,
    tasks: parsed.plan.tasks,
    risks: parsed.plan.risks,
    decisions,
    outputs: parsed.plan.outputs,
    successCriteria: parsed.plan.successCriteria,
    resources: parsed.plan.resources,
    deadline: parsed.plan.deadline,
    criticalPath,
    contextEvidence: context.relevantKnowledge,
    workspaceId,
    createdAt: new Date().toISOString(),
    validationIssues,
    revisionOf: null,
    revisionReason: null,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
  }

  // Intelligence Ledger — best-effort, never throws, never alters this
  // function's own plan (see recordPlanningIntelligenceRecord.ts).
  await recordPlanningIntelligenceRecord({ plan, workspaceId, operationId: operation.operationId, providerId })

  return { plan }
}
