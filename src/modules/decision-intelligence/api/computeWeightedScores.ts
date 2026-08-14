import type { Alternative, AlternativeEvaluation, DecisionCriterion, WeightedScore } from '@/modules/decision-intelligence/decision'

/**
 * Deterministic weighted scoring — the sprint brief's non-negotiable
 * rule: "Do not allow the model to fabricate a final mathematical result
 * without the application validating it." The model may propose
 * criteria (with a raw, un-normalized weight), alternatives, and
 * per-(alternative,criterion) scores; this function is the ONLY place
 * a "weighted score" is ever computed, and it is pure arithmetic over
 * already-parsed data — no AI call, no heuristic guessing.
 *
 * weighted score = sum(normalizedWeight(criterion) × score(alternative, criterion))
 *
 * Only criteria with a positive, finite weight participate — a
 * zero/negative/non-finite weight is excluded from normalization
 * entirely (validateDecision.ts is what surfaces this as an
 * invalid_criterion_weight issue; this function just doesn't use it,
 * rather than silently treating it as zero-influence, which could
 * misleadingly look like a deliberate "unimportant" tag).
 *
 * A missing evaluation for a (alternative, criterion) pair is never
 * filled in with an assumed/average score — it's recorded in
 * `missingCriterionIds` and simply excluded from that alternative's
 * total, so two alternatives' totals are only directly comparable when
 * neither has missing criteria (validateDecision.ts flags this).
 */
export function computeWeightedScores(criteria: DecisionCriterion[], alternatives: Alternative[], evaluations: AlternativeEvaluation[]): WeightedScore[] {
  const validCriteria = criteria.filter((c) => Number.isFinite(c.weight) && c.weight > 0)
  if (validCriteria.length === 0) return []

  const totalWeight = validCriteria.reduce((sum, c) => sum + c.weight, 0)
  const normalizedWeightById = new Map(validCriteria.map((c) => [c.id, c.weight / totalWeight]))

  return alternatives.map((alternative) => {
    const breakdown: WeightedScore['breakdown'] = []
    const missingCriterionIds: string[] = []

    for (const criterion of validCriteria) {
      const evaluation = evaluations.find((e) => e.alternativeId === alternative.id && e.criterionId === criterion.id)
      if (!evaluation) {
        missingCriterionIds.push(criterion.id)
        continue
      }
      const normalizedWeight = normalizedWeightById.get(criterion.id)!
      breakdown.push({ criterionId: criterion.id, normalizedWeight, score: evaluation.score, contribution: normalizedWeight * evaluation.score })
    }

    return {
      alternativeId: alternative.id,
      totalScore: breakdown.reduce((sum, b) => sum + b.contribution, 0),
      breakdown,
      missingCriterionIds,
    }
  })
}
