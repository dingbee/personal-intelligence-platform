import { hasFeature } from '@/modules/plans/api/plans'
import { PLANNING_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/planningIntelligence'
import { formatPlanForRevisionPrompt } from '@/modules/planning-intelligence/api/formatPlanForRevisionPrompt'
import { parseRevisedPlanningResponse } from '@/modules/planning-intelligence/api/parseRevisedPlanningResponse'
import { validatePlan } from '@/modules/planning-intelligence/api/validatePlan'
import { computePlanSchedule } from '@/modules/planning-intelligence/api/computePlanSchedule'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { beginIntelligenceOperation, runOperationAiCall, OperationBudgetExhaustedError, IntelligenceOperationQuotaDeniedError } from '@/shared/lib/intelligenceOperations'
import { recordPlanningIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordPlanningIntelligenceRecord'
import type { Plan } from '@/modules/planning-intelligence/plan'

export interface PlanRevisionOutcome {
  plan: Plan
}

function unrevisedPlan(originalPlan: Plan, change: string, overrides: Partial<Plan> & { status: 'declined' | 'failed' }): Plan {
  return {
    ...originalPlan,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    revisionOf: originalPlan.id,
    revisionReason: change,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    ...overrides,
  }
}

/**
 * Plan Revision (I6.19) — updates an existing, already-complete Plan in
 * response to ONE real described change (a shortened deadline, a
 * removed resource, a delayed dependency), rather than blindly
 * regenerating a lookalike plan from nothing. Mirrors
 * runPlanningIntelligence.ts's own shape exactly (same feature key, same
 * quota key — 'planning_intelligence_operations' — since this is the
 * same capability domain, not a second one): buildContext (here,
 * formatPlanForRevisionPrompt.ts, which needs no new retrieval —
 * the original Plan's own context IS the context) -> one runCapability
 * call -> parseRevisedPlanningResponse (which preserves unaffected
 * milestones/tasks by REUSING their real ids, see that file's own doc
 * comment) -> validatePlan/computePlanSchedule -> a new Plan record with
 * `revisionOf`/`revisionReason` set. Genuinely unresolved decision
 * points the revision itself surfaces are delegated to Decision
 * Intelligence exactly like initial generation — reusing
 * delegateUnresolvedDecisions from runPlanningIntelligence.ts, not a
 * second copy of that logic.
 */
export async function revisePlanningIntelligence(params: {
  plan: Plan
  change: string
  userId: string
  workspaceId: string | null
  chain: string[]
}): Promise<PlanRevisionOutcome> {
  const { plan: originalPlan, change, userId, workspaceId, chain } = params

  if (!(await hasFeature(userId, PLANNING_INTELLIGENCE_FEATURE_KEY))) {
    throw new Error('Planning Intelligence requires an upgraded plan.')
  }

  if (!change.trim()) {
    return { plan: unrevisedPlan(originalPlan, change, { status: 'declined', declineReason: 'A description of what changed is required to revise a plan.' }) }
  }

  if (originalPlan.status !== 'complete') {
    return { plan: unrevisedPlan(originalPlan, change, { status: 'declined', declineReason: 'Only a completed plan can be revised.' }) }
  }

  let operation
  try {
    operation = await beginIntelligenceOperation({ operationType: 'planning_intelligence', userId, workspaceId })
  } catch (err) {
    if (err instanceof IntelligenceOperationQuotaDeniedError) {
      return { plan: unrevisedPlan(originalPlan, change, { status: 'failed', declineReason: err.message }) }
    }
    throw err
  }

  const revisionSummary = formatPlanForRevisionPrompt(originalPlan, change)

  let call
  let providerId: string
  try {
    ;({ result: call, providerId } = await runOperationAiCall(operation, chain, (candidateId) =>
      runCapability({
        capabilityId: 'planning-revise-plan',
        variables: { revisionSummary },
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
      return { plan: unrevisedPlan(originalPlan, change, { status: 'failed', budgetExhausted: true, declineReason: 'Operation budget exhausted before the revision could complete.' }) }
    }
    throw err
  }

  operation.status = 'completed'

  const parsed = parseRevisedPlanningResponse(call.content, originalPlan)

  if (parsed.status === 'declined') {
    return { plan: unrevisedPlan(originalPlan, change, { status: 'declined', declineReason: parsed.reason }) }
  }
  if (parsed.status === 'invalid') {
    return { plan: unrevisedPlan(originalPlan, change, { status: 'failed', generationFailed: true, declineReason: parsed.reason }) }
  }

  const validationIssues = validatePlan(originalPlan.objective, parsed.plan)
  const { criticalPath } = computePlanSchedule(parsed.plan.tasks, parsed.plan.resources)

  const plan: Plan = {
    id: crypto.randomUUID(),
    title: parsed.plan.title,
    objective: originalPlan.objective,
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
    // A revised decision keeps whatever decisionIntelligence the ORIGINAL plan already
    // resolved for the same decision text, rather than re-delegating (and re-metering) a
    // decision the change didn't actually touch — a genuinely NEW or reworded decision
    // point gets none, exactly like initial generation, since this parse pass never
    // fabricates one itself.
    decisions: parsed.plan.decisions.map((d) => {
      const previous = originalPlan.decisions.find((p) => p.decision === d.decision)
      return previous?.decisionIntelligence ? { ...d, decisionIntelligence: previous.decisionIntelligence, recommendation: d.recommendation ?? previous.recommendation } : d
    }),
    outputs: parsed.plan.outputs,
    successCriteria: parsed.plan.successCriteria,
    resources: parsed.plan.resources,
    deadline: parsed.plan.deadline,
    criticalPath,
    contextEvidence: originalPlan.contextEvidence,
    workspaceId,
    createdAt: new Date().toISOString(),
    validationIssues,
    revisionOf: originalPlan.id,
    revisionReason: change,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
  }

  // Intelligence Ledger — best-effort, never throws, never alters this
  // function's own plan (see recordPlanningIntelligenceRecord.ts).
  await recordPlanningIntelligenceRecord({ plan, workspaceId, operationId: operation.operationId, providerId })

  return { plan }
}
