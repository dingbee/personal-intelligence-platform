import { describe, expect, it } from 'vitest'
import { computeConfidenceCalibrationBuckets } from '@/modules/learning-intelligence/api/computeConfidenceCalibration'
import type { OutcomeEvaluation } from '@/modules/learning-intelligence/learning'

function evaluation(overrides: Partial<OutcomeEvaluation> = {}): OutcomeEvaluation {
  return {
    id: 'evaluation-1',
    userId: 'user-1',
    workspaceId: null,
    recordId: 'record-1',
    source: 'system_observed',
    expectedOutcome: 'x',
    actualOutcome: 'y',
    comparisonResult: 'match',
    executionSucceeded: null,
    feedbackNote: null,
    patternKey: 'decision:confidence:high',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('computeConfidenceCalibrationBuckets', () => {
  it('reports insufficient_data (null matchRate) below the minimum evidence threshold', () => {
    const buckets = computeConfidenceCalibrationBuckets([evaluation(), evaluation({ id: 'e2' })])
    const high = buckets.find((b) => b.confidence === 'high')!
    expect(high.evaluationCount).toBe(2)
    expect(high.matchRate).toBeNull()
  })

  it('computes a real match rate once the minimum evidence threshold is reached', () => {
    const evaluations = [
      evaluation({ id: 'e1', comparisonResult: 'match' }),
      evaluation({ id: 'e2', comparisonResult: 'match' }),
      evaluation({ id: 'e3', comparisonResult: 'miss' }),
    ]
    const buckets = computeConfidenceCalibrationBuckets(evaluations)
    const high = buckets.find((b) => b.confidence === 'high')!
    expect(high.evaluationCount).toBe(3)
    expect(high.matchCount).toBe(2)
    expect(high.matchRate).toBeCloseTo(2 / 3)
  })

  it('counts partial_match toward matchCount, contradiction/miss against it', () => {
    const evaluations = [
      evaluation({ id: 'e1', comparisonResult: 'partial_match' }),
      evaluation({ id: 'e2', comparisonResult: 'contradiction' }),
      evaluation({ id: 'e3', comparisonResult: 'miss' }),
    ]
    const buckets = computeConfidenceCalibrationBuckets(evaluations)
    const high = buckets.find((b) => b.confidence === 'high')!
    expect(high.matchCount).toBe(1)
    expect(high.evaluationCount).toBe(3)
  })

  it('never counts an unknown comparison toward evidence at all — an unverified claim proves nothing about calibration', () => {
    const evaluations = [evaluation({ id: 'e1', comparisonResult: 'unknown' }), evaluation({ id: 'e2', comparisonResult: 'unknown' }), evaluation({ id: 'e3', comparisonResult: 'unknown' })]
    const buckets = computeConfidenceCalibrationBuckets(evaluations)
    const high = buckets.find((b) => b.confidence === 'high')!
    expect(high.evaluationCount).toBe(0)
    expect(high.matchRate).toBeNull()
  })

  it('keeps low/medium/high buckets independent — evidence in one never bleeds into another', () => {
    const evaluations = [
      evaluation({ id: 'e1', patternKey: 'decision:confidence:low', comparisonResult: 'miss' }),
      evaluation({ id: 'e2', patternKey: 'decision:confidence:low', comparisonResult: 'miss' }),
      evaluation({ id: 'e3', patternKey: 'decision:confidence:low', comparisonResult: 'miss' }),
      evaluation({ id: 'e4', patternKey: 'decision:confidence:high', comparisonResult: 'match' }),
      evaluation({ id: 'e5', patternKey: 'decision:confidence:high', comparisonResult: 'match' }),
      evaluation({ id: 'e6', patternKey: 'decision:confidence:high', comparisonResult: 'match' }),
    ]
    const buckets = computeConfidenceCalibrationBuckets(evaluations)
    expect(buckets.find((b) => b.confidence === 'low')!.matchRate).toBe(0)
    expect(buckets.find((b) => b.confidence === 'high')!.matchRate).toBe(1)
    expect(buckets.find((b) => b.confidence === 'medium')!.evaluationCount).toBe(0)
  })

  it('ignores evaluations from an unrelated pattern (e.g. execution-derived) entirely', () => {
    const evaluations = [evaluation({ patternKey: 'execution:capability:save_action_to_notes' })]
    const buckets = computeConfidenceCalibrationBuckets(evaluations)
    expect(buckets.every((b) => b.evaluationCount === 0)).toBe(true)
  })
})
