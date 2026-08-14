import { quotaService } from '@/shared/lib/quotaService'
import { runWithFallback, type FallbackResult } from '@/modules/ai/router/runWithFallback'

/**
 * Operation Budget Foundation — the minimum shared infrastructure the
 * autonomy/cost/quota architecture audit (docs/autonomy-cost-quota-
 * architecture-audit.md) recommended before another multi-step
 * intelligence engine is introduced: Data/Analysis/Research Intelligence
 * were feature-gated (hasFeature) but consumed zero metered quota, while
 * chat's ai_messages quota is the only real usage accounting anywhere in
 * the app. This module closes that gap additively, reusing the existing
 * quota_usage/plan_quotas/consume_quota/resolve_effective_quota_limit
 * machinery exactly as AIService.sendMessage already does for
 * 'ai_messages' — it does not introduce a second quota system.
 *
 * An IntelligenceOperation is an in-process, function-scoped tracker,
 * not a persisted record: every orchestration function this wires into
 * (runDataIntelligenceQuery, runAnalysisInvestigation,
 * runResearchInvestigation) runs start-to-finish within one call stack,
 * so there is nothing to resume across requests — see the audit's own
 * §4 recommendation to prefer application-level state over a new table
 * unless genuinely required. The one thing that IS persisted is
 * `operation_id` on `ai_requests` (this sprint's migration), so every
 * real AI call this operation made remains individually auditable and
 * groupable after the fact.
 */
export type IntelligenceOperationType = 'data_intelligence' | 'analysis_intelligence' | 'research_intelligence' | 'planning_intelligence' | 'decision_intelligence' | 'action_intelligence'

/**
 * The hard, per-operation AI-call ceiling — a safety backstop, not an
 * expected limit (mirrors resolveEvidenceChain.ts's MAX_CHAIN_DEPTH
 * precedent). Derived directly from each engine's own documented
 * worst-case call count times the real provider-fallback chain length
 * (3 — anthropic/openai/google are the only chat providers with
 * status:'available' in coreModule.ts today):
 *
 *   data_intelligence:     2 AI calls (plan + interpretation)            × 3 = 6
 *   analysis_intelligence: (MAX_INVESTIGATION_STEPS=5 + 1 synthesis)     × 3 = 18
 *   research_intelligence: (MAX_RESEARCH_STEPS=4×2 + (5+1) delegation +1 synthesis) × 3 = 45
 *                           — the audit's own §7/§11 arithmetic, confirmed against
 *                             runResearchInvestigation.ts's doc comment.
 *   decision_intelligence: 1 AI call (single-pass structured decision analysis, no
 *                           step loop — see runDecisionIntelligence.ts)     × 3 = 3
 *   action_intelligence:   1 AI call (single-pass structured action-set generation, no
 *                           step loop — see runActionIntelligence.ts)       × 3 = 3
 *   planning_intelligence: 1 AI call (single-pass structured plan generation, no
 *                           step loop — see runPlanningIntelligence.ts)     × 3 = 3
 *
 * These are intentionally NOT imported from analysis-intelligence/
 * research-intelligence's own MAX_ constants (which would pull a
 * shared/lib module into a domain-module dependency) — kept in sync by
 * hand, documented here, and re-derivable from those constants' own
 * comments if either ever changes. Preserving the existing engine step
 * ceilings unmodified was an explicit requirement of this sprint.
 */
const INTELLIGENCE_OPERATION_HARD_CEILINGS: Record<IntelligenceOperationType, number> = {
  data_intelligence: 6,
  analysis_intelligence: 18,
  research_intelligence: 45,
  planning_intelligence: 3,
  decision_intelligence: 3,
  action_intelligence: 3,
}

/**
 * One quota_key per operation type, mirroring the existing per-engine
 * 'feature:data_intelligence'/'feature:analysis_intelligence'/
 * 'feature:research_intelligence' entitlement convention (0058/0059/
 * 0060) — a monthly-scoped, real usage counter, metered exactly like
 * 'ai_messages' already is (see migration 0061). Distinct from
 * entitlement: `hasFeature` answers "can this user use this capability
 * at all," this key answers "how much AI work has this user's use of it
 * actually consumed this month."
 */
const INTELLIGENCE_OPERATION_QUOTA_KEYS: Record<IntelligenceOperationType, string> = {
  data_intelligence: 'data_intelligence_operations',
  analysis_intelligence: 'analysis_intelligence_operations',
  research_intelligence: 'research_intelligence_operations',
  planning_intelligence: 'planning_intelligence_operations',
  decision_intelligence: 'decision_intelligence_operations',
  action_intelligence: 'action_intelligence_operations',
}

export type IntelligenceOperationStatus = 'ready' | 'running' | 'completed' | 'failed' | 'budget_exhausted'

/**
 * A single professional-intelligence invocation's operation identity and
 * live budget state. Deliberately a plain mutable object (not persisted,
 * not immutable-update-style like AnalysisInvestigation/
 * ResearchInvestigation which flow outward to the UI) — this is an
 * internal orchestration-loop tracker with a lifetime of one function
 * call, not application state.
 */
export interface IntelligenceOperation {
  operationId: string
  operationType: IntelligenceOperationType
  userId: string
  workspaceId: string | null
  /** The effective, server-resolved ceiling this operation may not exceed — see beginIntelligenceOperation. */
  maxCalls: number
  /** Real AI calls attempted so far, success or failure, including every individual provider-fallback attempt. */
  callsConsumed: number
  status: IntelligenceOperationStatus
}

/**
 * Thrown when an operation's AI-call budget is exhausted — distinguishable
 * from a provider failure, a retrieval failure, an entitlement denial, an
 * invalid analytical plan, a synthesis parse failure, or an
 * authentication failure (all of which throw their own existing error
 * types elsewhere in this codebase). Callers must never convert this into
 * a generic error or fabricate a result to work around it.
 */
export class OperationBudgetExhaustedError extends Error {
  operationType: IntelligenceOperationType
  maxCalls: number

  constructor(operationType: IntelligenceOperationType, maxCalls: number) {
    super(`Operation budget exhausted for ${operationType} (max ${maxCalls} AI calls for this operation).`)
    this.name = 'OperationBudgetExhaustedError'
    this.operationType = operationType
    this.maxCalls = maxCalls
  }
}

/**
 * Thrown when the operation cannot even begin because the caller's
 * monthly operation quota (the same quota_usage/plan_quotas mechanism
 * 'ai_messages' already uses) is already exhausted — the "operation
 * budget check" gate in the sprint's own flow diagram, positioned after
 * entitlement and before any AI planning call.
 */
export class IntelligenceOperationQuotaDeniedError extends Error {
  operationType: IntelligenceOperationType

  constructor(operationType: IntelligenceOperationType, reason: string) {
    super(reason)
    this.name = 'IntelligenceOperationQuotaDeniedError'
    this.operationType = operationType
  }
}

/**
 * Resolves the effective per-operation AI-call budget and opens the
 * operation, gated by the same monthly quota_usage/plan_quotas
 * mechanism 'ai_messages' already uses (`quotaService.checkQuota`) —
 * denies starting the operation outright if the caller's
 * `<type>_operations` quota is already exhausted for this period, before
 * any AI call is made, mirroring AIService.sendMessage's own pre-flight
 * `checkQuota('ai_messages')` gate exactly.
 *
 * effectiveBudget = min(hard engine safety ceiling, requestedBudget ??
 * ceiling) — a client-supplied `requestedBudget` can only ever narrow
 * the budget, never widen it past the hard ceiling (§8 of the sprint
 * brief: "Do not allow a client request to increase the server-side
 * maximum"). No plan-tier-specific per-operation override exists yet
 * (Student/Enterprise are explicitly out of scope this sprint) — every
 * entitled caller today (Pro, Founding Pro) receives the same hard
 * ceiling; the monthly quota_key is what's actually plan-differentiable
 * (via the existing admin_update_plan_quota / user_quota_overrides
 * machinery), consistent with how 'ai_messages' already varies by plan.
 */
export async function beginIntelligenceOperation(params: {
  operationType: IntelligenceOperationType
  userId: string
  workspaceId: string | null
  requestedBudget?: number
}): Promise<IntelligenceOperation> {
  const { operationType, userId, workspaceId, requestedBudget } = params
  const quotaKey = INTELLIGENCE_OPERATION_QUOTA_KEYS[operationType]

  const quota = await quotaService.checkQuota(userId, quotaKey)
  if (!quota.allowed) {
    throw new IntelligenceOperationQuotaDeniedError(operationType, quota.reason ?? `${operationType} operation quota limit reached for this period.`)
  }

  const hardCeiling = INTELLIGENCE_OPERATION_HARD_CEILINGS[operationType]
  const maxCalls = requestedBudget ? Math.min(hardCeiling, requestedBudget) : hardCeiling

  return { operationId: crypto.randomUUID(), operationType, userId, workspaceId, maxCalls, callsConsumed: 0, status: 'ready' }
}

export function isOperationBudgetExhausted(operation: IntelligenceOperation): boolean {
  return operation.callsConsumed >= operation.maxCalls
}

/**
 * Records one real AI-call attempt (success or failure — both consumed
 * real execution capacity, per the sprint brief's §20 semantics) against
 * the operation's in-memory counter and the same monthly
 * quota_usage/consume_quota mechanism 'ai_messages' already uses. Never
 * called for deterministic computation, retrieval, or any non-AI step —
 * callers only invoke this from within runOperationAiCall, immediately
 * around a real provider attempt.
 */
async function recordOperationAiCall(operation: IntelligenceOperation): Promise<void> {
  operation.callsConsumed += 1
  await quotaService.consumeQuota(operation.userId, INTELLIGENCE_OPERATION_QUOTA_KEYS[operation.operationType])
}

/**
 * The budget-aware counterpart of runWithFallback: identical fallback
 * behavior (try each candidate in order, return on first success), but
 * (a) refuses to start if the operation's budget is already exhausted,
 * (b) records one consumed call for every real attempt — success or
 * failure, including every individual provider-fallback attempt (§6/§20
 * of the sprint brief: "a failure = 1 call consumed... do not treat
 * fallback as invisible") — and (c) stops trying further candidates once
 * the budget is exhausted mid-chain, surfacing OperationBudgetExhausted
 * Error distinctly from a genuine provider failure (which still
 * propagates unchanged when the budget was not the actual cause).
 */
export async function runOperationAiCall<T>(operation: IntelligenceOperation, chain: string[], run: (providerId: string) => Promise<T>): Promise<FallbackResult<T>> {
  if (isOperationBudgetExhausted(operation)) {
    operation.status = 'budget_exhausted'
    throw new OperationBudgetExhaustedError(operation.operationType, operation.maxCalls)
  }
  operation.status = 'running'

  try {
    return await runWithFallback(
      chain,
      async (providerId) => {
        try {
          return await run(providerId)
        } finally {
          await recordOperationAiCall(operation)
        }
      },
      { shouldAbort: () => isOperationBudgetExhausted(operation) },
    )
  } catch (err) {
    if (isOperationBudgetExhausted(operation)) {
      operation.status = 'budget_exhausted'
      throw new OperationBudgetExhaustedError(operation.operationType, operation.maxCalls)
    }
    throw err
  }
}
