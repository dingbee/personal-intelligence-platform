import type { ParsedDecisionFields } from '@/modules/decision-intelligence/api/parseDecisionResponse'
import type { DecisionValidationIssue, WeightedScore } from '@/modules/decision-intelligence/decision'

const MIN_SCORE = 0
const MAX_SCORE = 10

/**
 * Deterministic structural validation for a parsed decision — the
 * sprint brief's Phase 11 checklist, and the same "never silently
 * repair" discipline as validatePlan.ts. Operates on the already-parsed
 * fields as the sole source of truth, independent of whatever the
 * parser already filtered — a validator's whole point is to be an
 * independent check.
 *
 * `weightedScores` is passed in (computed once by
 * runDecisionIntelligence.ts via computeWeightedScores.ts) rather than
 * recomputed here, so the validator, the sensitivity layer, and the
 * final Decision record all agree on the exact same numbers — never
 * three different implementations of the same arithmetic.
 *
 * What this deliberately does NOT (and structurally cannot) validate:
 * whether a stated "known" fact is actually true, or whether an
 * advantage/disadvantage is a fair characterization — that requires
 * semantic judgment no deterministic pass can perform. This only checks
 * structural coherence, referential integrity, and evidence-vs-
 * confidence consistency.
 */
export function validateDecision(params: {
  question: string
  objective: string | null
  fields: ParsedDecisionFields
  weightedScores: WeightedScore[]
  contextEvidenceCount: number
}): DecisionValidationIssue[] {
  const { question, objective, fields, weightedScores, contextEvidenceCount } = params
  const issues: DecisionValidationIssue[] = []

  if (!question.trim()) {
    issues.push({ kind: 'missing_question', message: 'The decision has no question.', affectedIds: [] })
  }
  if (!objective) {
    issues.push({ kind: 'missing_objective', message: 'The decision has no stated objective.', affectedIds: [] })
  }
  if (fields.alternatives.length < 2) {
    issues.push({ kind: 'insufficient_alternatives', message: 'The decision has fewer than two meaningful alternatives.', affectedIds: fields.alternatives.map((a) => a.id) })
  }
  if (fields.criteria.length === 0) {
    issues.push({ kind: 'missing_criteria', message: 'The decision has no scoring criteria.', affectedIds: [] })
  }

  const alternativeIds = new Set(fields.alternatives.map((a) => a.id))
  const criterionIds = new Set(fields.criteria.map((c) => c.id))

  if (alternativeIds.size !== fields.alternatives.length) {
    issues.push({ kind: 'duplicate_id', message: 'Two or more alternatives share the same id.', affectedIds: fields.alternatives.map((a) => a.id) })
  }
  if (criterionIds.size !== fields.criteria.length) {
    issues.push({ kind: 'duplicate_id', message: 'Two or more criteria share the same id.', affectedIds: fields.criteria.map((c) => c.id) })
  }

  for (const criterion of fields.criteria) {
    if (!Number.isFinite(criterion.weight) || criterion.weight <= 0) {
      issues.push({ kind: 'invalid_criterion_weight', message: `Criterion "${criterion.name}" has an invalid weight and was excluded from scoring.`, affectedIds: [criterion.id] })
    }
  }

  for (const evaluation of fields.evaluations) {
    if (!alternativeIds.has(evaluation.alternativeId)) {
      issues.push({ kind: 'dangling_alternative_reference', message: 'An evaluation references an alternative that does not exist in this decision.', affectedIds: [evaluation.alternativeId] })
    }
    if (!criterionIds.has(evaluation.criterionId)) {
      issues.push({ kind: 'dangling_criterion_reference', message: 'An evaluation references a criterion that does not exist in this decision.', affectedIds: [evaluation.criterionId] })
    }
    if (evaluation.score < MIN_SCORE || evaluation.score > MAX_SCORE) {
      issues.push({ kind: 'invalid_score', message: `A score of ${evaluation.score} is outside the valid ${MIN_SCORE}-${MAX_SCORE} range.`, affectedIds: [evaluation.alternativeId, evaluation.criterionId] })
    }
  }

  for (const alternative of fields.alternatives) {
    const hasAnyEvaluation = fields.evaluations.some((e) => e.alternativeId === alternative.id)
    if (!hasAnyEvaluation && fields.criteria.length > 0) {
      issues.push({ kind: 'missing_evaluation', message: `Alternative "${alternative.title}" has no evaluations against any criterion.`, affectedIds: [alternative.id] })
    }
  }

  if (!fields.recommendedAlternativeId || !alternativeIds.has(fields.recommendedAlternativeId)) {
    issues.push({ kind: 'recommendation_references_unknown_alternative', message: 'The recommendation does not name a real alternative from this decision.', affectedIds: fields.recommendedAlternativeId ? [fields.recommendedAlternativeId] : [] })
  }

  if (!fields.rationale) {
    issues.push({ kind: 'missing_rationale', message: 'The decision has no rationale for its recommendation.', affectedIds: [] })
  }

  const recommendedEvaluations = fields.evaluations.filter((e) => e.alternativeId === fields.recommendedAlternativeId)
  const recommendationHasEvidence = recommendedEvaluations.some((e) => e.evidenceIds.length > 0)

  if (contextEvidenceCount > 0 && recommendedEvaluations.length > 0 && !recommendationHasEvidence) {
    issues.push({ kind: 'missing_evidence_for_claim', message: 'Evidence was available but none of it was cited to support the recommended alternative.', affectedIds: fields.recommendedAlternativeId ? [fields.recommendedAlternativeId] : [] })
  }

  if (fields.confidence === 'high' && (contextEvidenceCount === 0 || !recommendationHasEvidence)) {
    issues.push({ kind: 'unsupported_certainty', message: 'High confidence was claimed without evidence backing the recommended alternative\'s evaluations.', affectedIds: fields.recommendedAlternativeId ? [fields.recommendedAlternativeId] : [] })
  }

  if (weightedScores.length > 0 && fields.recommendedAlternativeId) {
    const ranked = [...weightedScores].sort((a, b) => b.totalScore - a.totalScore)
    const top = ranked[0]
    if (top && top.alternativeId !== fields.recommendedAlternativeId) {
      const recommendedTitle = fields.alternatives.find((a) => a.id === fields.recommendedAlternativeId)?.title ?? fields.recommendedAlternativeId
      const topTitle = fields.alternatives.find((a) => a.id === top.alternativeId)?.title ?? top.alternativeId
      issues.push({
        kind: 'contradictory_recommendation',
        message: `The model recommends "${recommendedTitle}", but the deterministically computed weighted scores rank "${topTitle}" highest.`,
        affectedIds: [fields.recommendedAlternativeId, top.alternativeId],
      })
    }
  }

  return issues
}
