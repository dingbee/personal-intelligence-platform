import { hasFeature } from '@/modules/plans/api/plans'
import { ACTION_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/actionIntelligence'
import { buildActionContext } from '@/modules/action-intelligence/api/buildActionContext'
import { formatActionContextForPrompt } from '@/modules/action-intelligence/api/formatActionContextForPrompt'
import { parseActionResponse } from '@/modules/action-intelligence/api/parseActionResponse'
import { analyzeActionDependencies } from '@/modules/action-intelligence/api/analyzeActionDependencies'
import { computeActionReadiness } from '@/modules/action-intelligence/api/computeActionReadiness'
import { computeActionPriorities } from '@/modules/action-intelligence/api/computeActionPriorities'
import { validateAction } from '@/modules/action-intelligence/api/validateAction'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { beginIntelligenceOperation, runOperationAiCall, OperationBudgetExhaustedError, IntelligenceOperationQuotaDeniedError } from '@/shared/lib/intelligenceOperations'
import type { PlanDerivedActionContext } from '@/modules/action-intelligence/api/adaptPlanForActionContext'
import type { DecisionDerivedActionContext } from '@/modules/action-intelligence/api/adaptDecisionForActionContext'
import type { Action, ActionSet, ActionSetStatus, ActionSource } from '@/modules/action-intelligence/action'

export interface ActionIntelligenceOutcome {
  actionSet: ActionSet
}

function emptyActionSet(objective: string | null, workspaceId: string | null, overrides: Partial<ActionSet> & { status: ActionSetStatus }): ActionSet {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled action set',
    objective,
    actions: [],
    contextEvidence: [],
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

/** One consistent `source` for the whole generated batch — see parseActionResponse.ts's own doc comment on why per-action attribution isn't asked of the model. Decision takes priority over plan (an action set generated "to carry out this decision, in service of this plan" is fundamentally about the decision), and an explicit instruction with neither is its own source; evidence-only context (no plan/decision/instruction at all) is the honest fallback. */
function determineSource(instruction: string | null, planContext: PlanDerivedActionContext | null, decisionContext: DecisionDerivedActionContext | null): ActionSource {
  if (decisionContext) return { kind: 'decision', label: decisionContext.decisionQuestion }
  if (planContext) return { kind: 'plan', label: planContext.planTitle }
  if (instruction) return { kind: 'user_instruction', label: instruction }
  return { kind: 'evidence', label: 'retrieved evidence' }
}

/**
 * Action Intelligence's orchestration function — the sprint brief's own
 * flow (Phase 9), one bounded generation pass, mirroring Planning/
 * Decision Intelligence's own single-pass orchestration exactly: no step
 * loop, no autonomous execution. Everything after the one AI call is
 * deterministic application code: analyzeActionDependencies.ts (cycles/
 * dangling refs) -> computeActionReadiness.ts (the core "is this
 * actually ready" differentiator) -> computeActionPriorities.ts ->
 * validateAction.ts -> provenance already attached via
 * context.relevantEvidence on the returned ActionSet.
 *
 * Works with any non-empty combination of {instruction, planContext,
 * decisionContext} (Phase 8's four input combinations) — declines
 * cleanly when given none of them and no objective either, since there
 * would be nothing real to ground actions in.
 */
export async function runActionIntelligence(params: {
  instruction?: string | null
  objective?: string | null
  userConstraints?: string[]
  userId: string
  workspaceId: string | null
  chain: string[]
  planContext?: PlanDerivedActionContext | null
  decisionContext?: DecisionDerivedActionContext | null
}): Promise<ActionIntelligenceOutcome> {
  const { instruction = null, objective = null, userConstraints = [], userId, workspaceId, chain, planContext = null, decisionContext = null } = params

  if (!(await hasFeature(userId, ACTION_INTELLIGENCE_FEATURE_KEY))) {
    throw new Error('Action Intelligence requires an upgraded plan.')
  }

  if (!instruction && !objective && !planContext && !decisionContext) {
    return { actionSet: emptyActionSet(objective, workspaceId, { status: 'declined', declineReason: 'An instruction, objective, plan, or decision is required to generate actions.' }) }
  }

  let operation
  try {
    operation = await beginIntelligenceOperation({ operationType: 'action_intelligence', userId, workspaceId })
  } catch (err) {
    if (err instanceof IntelligenceOperationQuotaDeniedError) {
      return { actionSet: emptyActionSet(objective, workspaceId, { status: 'failed', declineReason: err.message }) }
    }
    throw err
  }

  const context = await buildActionContext({ instruction, objective, userConstraints, userId, workspaceId, planContext, decisionContext })
  const actionSummary = formatActionContextForPrompt(context)

  let call
  try {
    ;({ result: call } = await runOperationAiCall(operation, chain, (candidateId) =>
      runCapability({
        capabilityId: 'action-generate-action-set',
        variables: { actionSummary },
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
      return { actionSet: emptyActionSet(objective, workspaceId, { status: 'failed', budgetExhausted: true, declineReason: 'Operation budget exhausted before action generation could complete.' }) }
    }
    throw err
  }

  operation.status = 'completed'

  const parsed = parseActionResponse(call.content, context.relevantEvidence, context.activeWorkspaceObjectives)

  if (parsed.status === 'declined') {
    return { actionSet: emptyActionSet(objective, workspaceId, { status: 'declined', declineReason: parsed.reason, contextEvidence: context.relevantEvidence }) }
  }
  if (parsed.status === 'invalid') {
    return { actionSet: emptyActionSet(objective, workspaceId, { status: 'failed', generationFailed: true, declineReason: parsed.reason, contextEvidence: context.relevantEvidence }) }
  }

  const { title, actions: parsedActions } = parsed.fields
  const dependencyAnalysis = analyzeActionDependencies(parsedActions)
  const readinessById = computeActionReadiness(parsedActions, dependencyAnalysis)
  const prioritiesById = computeActionPriorities(parsedActions)
  const source = determineSource(instruction, planContext, decisionContext)

  const actions: Action[] = parsedActions.map((a) => ({
    ...a,
    source,
    priority: prioritiesById.get(a.id) ?? a.priority,
    readiness: readinessById.get(a.id) ?? { state: 'blocked', blockers: ['Readiness could not be determined.'], missingInformation: [] },
  }))

  const validationIssues = validateAction({ objective, hasUpstreamContext: Boolean(planContext || decisionContext || instruction), actions, dependencyIssues: dependencyAnalysis.issues })

  const actionSet: ActionSet = {
    id: crypto.randomUUID(),
    title,
    objective,
    status: 'complete',
    actions,
    contextEvidence: context.relevantEvidence,
    validationIssues,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId,
    createdAt: new Date().toISOString(),
  }

  return { actionSet }
}
