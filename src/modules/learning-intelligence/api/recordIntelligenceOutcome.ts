import { supabase } from '@/shared/lib/supabase'
import { toOutcomeEvaluation } from '@/modules/learning-intelligence/api/mappers'
import type { OutcomeEvaluation, RecordIntelligenceOutcomeParams } from '@/modules/learning-intelligence/learning'

/**
 * The only way an outcome evaluation is recorded, and the only way a
 * learning signal is created/reinforced/contested — see
 * record_intelligence_outcome() in 0087_learning_intelligence_foundation.sql
 * for the actual reconciliation logic (deterministic, server-enforced,
 * not reimplemented here).
 */
export async function recordIntelligenceOutcome(params: RecordIntelligenceOutcomeParams): Promise<OutcomeEvaluation> {
  const { recordId, source, expectedOutcome, actualOutcome, comparisonResult, patternKey, executionSucceeded = null, feedbackNote = null } = params
  const { data, error } = await supabase.rpc('record_intelligence_outcome', {
    p_record_id: recordId,
    p_source: source,
    p_expected_outcome: expectedOutcome,
    p_actual_outcome: actualOutcome,
    p_comparison_result: comparisonResult,
    p_pattern_key: patternKey,
    p_execution_succeeded: executionSucceeded,
    p_feedback_note: feedbackNote,
  })
  if (error) throw error
  return toOutcomeEvaluation(data)
}

/**
 * Deterministic pattern-key derivation — one function per
 * IntelligenceRecordType this module currently supports evaluating.
 * Never free text an LLM invented (I8.6's own "same type of action + same
 * condition" requires a real, repeatable classification an evaluator
 * cannot arbitrarily vary run to run). New record types get a new,
 * explicit function here — never a generic fallback that could collapse
 * two genuinely different conditions into the same bucket.
 */

/** I8.18 — the capability itself is the only deterministic, repeatable "condition" Execution Foundation exposes today. */
export function deriveExecutionPatternKey(capability: string): string {
  return `execution:capability:${capability}`
}

/** I8.14/I8.16 — reusing Decision's own real `confidence` field doubles as the calibration axis: "decisions marked X confidence tend to match/miss." */
export function deriveDecisionPatternKey(confidence: 'low' | 'medium' | 'high'): string {
  return `decision:confidence:${confidence}`
}

/**
 * I8.17 — a fixed, small set of real plan-variance categories mirroring
 * the sprint's own examples (underestimated duration, resource
 * underestimation, recurring dependency failure, unrealistic milestone).
 * The caller recording a plan's outcome must pick one — never free text.
 */
export type PlanVarianceCategory = 'timeline_variance' | 'resource_variance' | 'dependency_variance' | 'milestone_realism' | 'general'

export function derivePlanningPatternKey(category: PlanVarianceCategory): string {
  return `planning:${category}`
}
