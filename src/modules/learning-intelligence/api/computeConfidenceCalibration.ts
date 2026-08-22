import { listOutcomeEvaluationsByPatternPrefix } from '@/modules/learning-intelligence/api/learningQueries'
import type { OutcomeEvaluation } from '@/modules/learning-intelligence/learning'

/** Never manufacture a rate from too little evidence (I8.14's own explicit instruction). Below this, a bucket is reported as insufficient_data rather than a misleadingly precise-looking percentage. */
const MIN_EVIDENCE_FOR_CALIBRATION = 3

export type DecisionConfidenceLevel = 'low' | 'medium' | 'high'

export interface ConfidenceCalibrationBucket {
  confidence: DecisionConfidenceLevel
  evaluationCount: number
  /** count of 'match' | 'partial_match' — a decision's own confidence borne out by what actually happened. */
  matchCount: number
  /** null when evaluationCount < MIN_EVIDENCE_FOR_CALIBRATION — an honest "not enough evidence yet," never a fabricated statistic. */
  matchRate: number | null
}

function bucketFromPatternKey(patternKey: string): DecisionConfidenceLevel | null {
  const prefix = 'decision:confidence:'
  if (!patternKey.startsWith(prefix)) return null
  const level = patternKey.slice(prefix.length)
  return level === 'low' || level === 'medium' || level === 'high' ? level : null
}

/**
 * I8.14 — compares Decision Intelligence's own stated confidence
 * (deriveDecisionPatternKey) against what verified/user-recorded outcome
 * evaluations actually show, to surface calibration drift where real
 * evidence supports it ("decisions marked 'high' confidence are only
 * matching their expected outcome 40% of the time"). Deliberately a pure
 * function over an already-fetched evaluation list — independently
 * testable, and reusable by both the live query path below and a future
 * caller that already has the evaluations in hand.
 */
export function computeConfidenceCalibrationBuckets(evaluations: OutcomeEvaluation[]): ConfidenceCalibrationBucket[] {
  const byBucket = new Map<DecisionConfidenceLevel, OutcomeEvaluation[]>()
  for (const evaluation of evaluations) {
    const bucket = bucketFromPatternKey(evaluation.patternKey)
    if (!bucket || evaluation.comparisonResult === 'unknown') continue
    const existing = byBucket.get(bucket) ?? []
    existing.push(evaluation)
    byBucket.set(bucket, existing)
  }

  const levels: DecisionConfidenceLevel[] = ['low', 'medium', 'high']
  return levels.map((confidence) => {
    const bucketEvaluations = byBucket.get(confidence) ?? []
    const matchCount = bucketEvaluations.filter((e) => e.comparisonResult === 'match' || e.comparisonResult === 'partial_match').length
    const evaluationCount = bucketEvaluations.length
    return {
      confidence,
      evaluationCount,
      matchCount,
      matchRate: evaluationCount >= MIN_EVIDENCE_FOR_CALIBRATION ? matchCount / evaluationCount : null,
    }
  })
}

export async function computeConfidenceCalibration(): Promise<ConfidenceCalibrationBucket[]> {
  const evaluations = await listOutcomeEvaluationsByPatternPrefix('decision:confidence:')
  return computeConfidenceCalibrationBuckets(evaluations)
}
