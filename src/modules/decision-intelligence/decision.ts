/**
 * ARRIYIA Professional Intelligence — Decision Intelligence.
 *
 * Answers "given the evidence, objectives, alternatives, constraints,
 * risks and assumptions, which option should we choose, why, what are
 * the trade-offs, and what would change the recommendation?" — a
 * distinct question from Planning Intelligence's "what should we do and
 * how should the work be structured?" (see plan.ts). Deliberately its
 * own domain model, not Plan fields repurposed: an Alternative/Criterion/
 * Evaluation triangle has no equivalent in Plan at all, and forcing it
 * into Plan's Milestone/Task shape would be a lossy, confusing fit.
 *
 * Mirrors Plan's own conventions: id-referenced flat records (not a
 * generic graph library), an InformationOrigin tag on assumptions
 * (known/assumed/unknown/requires_user_input), immutable-update
 * orchestration style, and an honest failure taxonomy (declined/failed/
 * generationFailed/budgetExhausted) — never a fabricated success.
 *
 * The one thing Decision adds beyond Plan's pattern: every weighted
 * score is computed by THIS application, deterministically, from the
 * model's proposed criteria/weights/evaluations — never trusted as a
 * number the model itself reports (see computeWeightedScores.ts). The
 * model may propose the inputs to the arithmetic; it never gets to state
 * the arithmetic's result.
 */

import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'

export type InformationOrigin = 'known' | 'assumed' | 'unknown' | 'requires_user_input'

/** 'dataset_investigation' mirrors Research Intelligence's own ResearchSourceType exactly (researchInvestigation.ts) — only ever constructed by buildDecisionContext.ts's own delegation to Analysis Intelligence, never by a plain gatherEvidence call. */
export type DecisionContextSourceType = 'document' | 'note' | 'asset' | 'dataset_investigation'

/** One real, retrieved passage the decision engine actually saw — identical contract to Plan's own PlanContextSource (see plan.ts), defined separately here rather than imported, so Decision and Planning stay independently evolvable per the sprint brief's "do not tightly couple the modules" instruction. */
export interface DecisionContextSource {
  id: string
  type: DecisionContextSourceType
  title: string
  excerpt: string
}

export interface Alternative {
  id: string
  title: string
  description: string
  advantages: string[]
  disadvantages: string[]
  /** Free-text, only when the model has a genuine basis — never a fabricated number (e.g. "could increase onboarding by an estimated 10-15%" only if evidence supports it; otherwise null). */
  estimatedImpact: string | null
  risks: string[]
  /** Real DecisionContextSource ids this alternative's description draws on. */
  evidenceIds: string[]
}

export type CriterionImportance = 'low' | 'medium' | 'high'

export interface DecisionCriterion {
  id: string
  name: string
  description: string
  /** Raw, model-proposed weight (any positive number) — normalized to a 0-1 fraction by computeWeightedScores.ts, never trusted as already-normalized. */
  weight: number
  importance: CriterionImportance
  /** How this criterion is meant to be evaluated (e.g. "estimated cost in USD, lower is better") — informational, not itself part of the arithmetic. */
  evaluationMethod: string | null
}

export interface AlternativeEvaluation {
  alternativeId: string
  criterionId: string
  /** 0-10, validated by validateDecision.ts — never trusted unranged. */
  score: number
  rationale: string
  evidenceIds: string[]
  confidence: 'low' | 'medium' | 'high'
}

export type RiskLevel = 'low' | 'medium' | 'high'

export interface DecisionRisk {
  id: string
  description: string
  /** null when the model has no honest basis to assess likelihood — never defaulted to a guess. */
  likelihood: RiskLevel | null
  impact: RiskLevel
  mitigation: string | null
  evidenceIds: string[]
}

export interface DecisionAssumption {
  id: string
  statement: string
  origin: InformationOrigin
  /** What changes about the recommendation if this assumption turns out false — informational, not itself simulated numerically (see computeSensitivity.ts's own, separate reversal-risk heuristic). */
  impactIfFalse: string | null
  evidenceIds: string[]
}

export type DecisionConstraintType = 'time' | 'budget' | 'resource' | 'technical' | 'organizational' | 'other'
export type DecisionConstraintSeverity = 'hard' | 'soft'

export interface DecisionConstraint {
  id: string
  constraint: string
  type: DecisionConstraintType
  severity: DecisionConstraintSeverity
}

/** One alternative's deterministically computed total — the ONLY source of a "score," never restated from the model's own claim. See computeWeightedScores.ts. */
export interface WeightedScore {
  alternativeId: string
  totalScore: number
  breakdown: { criterionId: string; normalizedWeight: number; score: number; contribution: number }[]
  /** Criteria this alternative had no evaluation for — the total above is computed only from what's present; never a fabricated fill-in. */
  missingCriterionIds: string[]
}

export type SensitivityInsightKind = 'criterion_influence' | 'assumption_reversal_risk' | 'weight_change_reversal' | 'missing_information_impact'

export interface SensitivityInsight {
  id: string
  kind: SensitivityInsightKind
  description: string
  affectedAlternativeIds: string[]
}

export type DecisionStatus = 'complete' | 'declined' | 'failed'

export type DecisionValidationIssueKind =
  | 'missing_question'
  | 'missing_objective'
  | 'insufficient_alternatives'
  | 'missing_criteria'
  | 'invalid_criterion_weight'
  | 'invalid_score'
  | 'dangling_alternative_reference'
  | 'dangling_criterion_reference'
  | 'duplicate_id'
  | 'missing_evaluation'
  | 'recommendation_references_unknown_alternative'
  | 'missing_rationale'
  | 'missing_evidence_for_claim'
  | 'unsupported_certainty'
  | 'contradictory_recommendation'

export interface DecisionValidationIssue {
  kind: DecisionValidationIssueKind
  message: string
  affectedIds: string[]
}

export interface Decision {
  id: string
  title: string
  question: string
  objective: string | null
  status: DecisionStatus
  alternatives: Alternative[]
  criteria: DecisionCriterion[]
  evaluations: AlternativeEvaluation[]
  /** Deterministically computed by this application — see computeWeightedScores.ts. Empty when criteria/evaluations are insufficient to compute anything real. */
  weightedScores: WeightedScore[]
  /** The alternative id the model recommends — null only when status !== 'complete'. */
  recommendedAlternativeId: string | null
  confidence: 'low' | 'medium' | 'high' | null
  rationale: string | null
  tradeoffs: string[]
  risks: DecisionRisk[]
  assumptions: DecisionAssumption[]
  constraints: DecisionConstraint[]
  unknowns: string[]
  consequences: string[]
  /** Deterministically computed — see computeSensitivity.ts. */
  sensitivity: SensitivityInsight[]
  nextAction: string | null
  contextEvidence: DecisionContextSource[]
  /** Populated only when this decision was scoped to a document with a real structured dataset — the real, unmodified AnalysisInvestigation this decision delegated to (see buildDecisionContext.ts), so a "which option costs less" style question can be grounded in an actually-computed number, not a document/note snippet's prose. Exposed so provenance can splice in the underlying AnalyticalPlan/AnalyticalResult chain directly, never re-derived — mirrors ResearchStep.datasetInvestigation exactly. Null when no document/dataset was in scope. */
  datasetInvestigation: AnalysisInvestigation | null
  /** True when the recommendation is hedged because material information was missing — an honest signal, not a fabricated confident answer. */
  provisional: boolean
  provisionalReason: string | null
  validationIssues: DecisionValidationIssue[]
  budgetExhausted: boolean
  generationFailed: boolean
  declineReason: string | null
  workspaceId: string | null
  createdAt: string
}
