import { hasFeature } from '@/modules/plans/api/plans'
import { PLANNING_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/planningIntelligence'
import { buildPlanningContext } from '@/modules/planning-intelligence/api/buildPlanningContext'
import { formatPlanningContextForPrompt } from '@/modules/planning-intelligence/api/formatPlanningContextForPrompt'
import { parsePlanningResponse } from '@/modules/planning-intelligence/api/parsePlanningResponse'
import { validatePlan } from '@/modules/planning-intelligence/api/validatePlan'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { beginIntelligenceOperation, runOperationAiCall, OperationBudgetExhaustedError, IntelligenceOperationQuotaDeniedError } from '@/shared/lib/intelligenceOperations'
import type { Plan, PlanStatus } from '@/modules/planning-intelligence/plan'

export interface PlanningOutcome {
  plan: Plan
}

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
    milestones: [],
    tasks: [],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
    contextEvidence: [],
    workspaceId,
    createdAt: new Date().toISOString(),
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    ...overrides,
  }
}

/**
 * Planning Intelligence's orchestration function, implementing the
 * brief's own flow in one linear pass — buildPlanningContext ->
 * (buildPlanningPrompt, inside module.ts's registered template) ->
 * executePlanningReasoning (this function's one runCapability call) ->
 * validatePlan -> returnStructuredPlan. Unlike Data/Analysis/Research
 * Intelligence there is no step loop: Planning has no dataset or
 * evidence to iteratively investigate, only already-assembled context to
 * reason over once, so a single bounded call is the whole engine (see
 * module.ts's doc comment for why this is proportionate, not a
 * shortcut).
 *
 * Operation Budget Foundation — opens exactly ONE IntelligenceOperation
 * (operationType 'planning_intelligence'), consistent with every sibling
 * engine.
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
  try {
    ;({ result: call } = await runOperationAiCall(operation, chain, (candidateId) =>
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
    milestones: parsed.plan.milestones,
    tasks: parsed.plan.tasks,
    risks: parsed.plan.risks,
    decisions: parsed.plan.decisions,
    outputs: parsed.plan.outputs,
    successCriteria: parsed.plan.successCriteria,
    contextEvidence: context.relevantKnowledge,
    workspaceId,
    createdAt: new Date().toISOString(),
    validationIssues,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
  }

  return { plan }
}
