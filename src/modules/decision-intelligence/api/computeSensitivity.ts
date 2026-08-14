import { computeWeightedScores } from '@/modules/decision-intelligence/api/computeWeightedScores'
import type { Alternative, AlternativeEvaluation, DecisionAssumption, DecisionCriterion, SensitivityInsight, WeightedScore } from '@/modules/decision-intelligence/decision'

/** Two alternatives' totals within this many points (on the 0-10 weighted scale) count as "close" — the threshold at which unresolved assumptions/unknowns are worth flagging as reversal risks. Documented, not tuned against real data — a v1 default. */
const CLOSE_SCORE_THRESHOLD = 0.5

function rankedAlternatives(weightedScores: WeightedScore[]): WeightedScore[] {
  return [...weightedScores].sort((a, b) => b.totalScore - a.totalScore)
}

/**
 * criterion_influence — for each criterion actually used in scoring,
 * recompute the ranking with that single criterion excluded. If the
 * top-ranked alternative changes, that criterion materially influences
 * the recommendation. Deterministic re-computation via
 * computeWeightedScores.ts itself (never a separate, potentially
 * inconsistent formula).
 */
function computeCriterionInfluence(criteria: DecisionCriterion[], alternatives: Alternative[], evaluations: AlternativeEvaluation[], baselineTop: string | null): SensitivityInsight[] {
  if (!baselineTop) return []
  const insights: SensitivityInsight[] = []

  for (const criterion of criteria) {
    const withoutIt = criteria.filter((c) => c.id !== criterion.id)
    const scoresWithout = computeWeightedScores(withoutIt, alternatives, evaluations)
    if (scoresWithout.length === 0) continue
    const topWithout = rankedAlternatives(scoresWithout)[0]!.alternativeId
    if (topWithout !== baselineTop) {
      const alt = alternatives.find((a) => a.id === topWithout)
      insights.push({
        id: crypto.randomUUID(),
        kind: 'criterion_influence',
        description: `Removing "${criterion.name}" from consideration changes the leading alternative to "${alt?.title ?? topWithout}" — this criterion materially influences the recommendation.`,
        affectedAlternativeIds: [baselineTop, topWithout],
      })
    }
  }

  return insights
}

/**
 * weight_change_reversal — a bounded, pairwise breakeven calculation
 * between the top two alternatives only (not a full optimization
 * engine, per the sprint brief's explicit v1 scope). Picks the single
 * criterion where the two differ most, and solves for the weight that
 * single criterion would need (holding every other criterion's relative
 * proportion fixed, rescaling to keep total weight at 1) for the two
 * alternatives' totals to become equal. A real, explainable answer, not
 * a simulation — see the derivation in this function's inline comments.
 */
function computeWeightChangeReversal(criteria: DecisionCriterion[], alternatives: Alternative[], weightedScores: WeightedScore[]): SensitivityInsight[] {
  const ranked = rankedAlternatives(weightedScores)
  if (ranked.length < 2) return []
  const [leader, runnerUp] = ranked
  if (leader!.breakdown.length === 0 || runnerUp!.breakdown.length === 0) return []

  // Only consider criteria both alternatives were actually evaluated on — a
  // criterion missing for either isn't a fair basis for a breakeven claim.
  const runnerUpByCriterion = new Map(runnerUp!.breakdown.map((b) => [b.criterionId, b]))
  let mostDifferentiating: { criterionId: string; diff: number; sLeader: number; sRunnerUp: number; weight: number } | null = null

  for (const b of leader!.breakdown) {
    const other = runnerUpByCriterion.get(b.criterionId)
    if (!other) continue
    const diff = Math.abs(b.score - other.score)
    if (!mostDifferentiating || diff > mostDifferentiating.diff) {
      mostDifferentiating = { criterionId: b.criterionId, diff, sLeader: b.score, sRunnerUp: other.score, weight: b.normalizedWeight }
    }
  }
  if (!mostDifferentiating || mostDifferentiating.diff === 0) return []

  const { criterionId, sLeader, sRunnerUp, weight: w } = mostDifferentiating
  if (w >= 1) return [] // nothing else to rescale

  // otherX = contribution to X's total from every OTHER criterion at current weights.
  const otherLeader = leader!.totalScore - w * sLeader
  const otherRunnerUp = runnerUp!.totalScore - w * sRunnerUp

  // Solve TA'(w') = TB'(w') where TX'(w') = w'*sX + otherX*(1-w')/(1-w).
  const d = sLeader - sRunnerUp
  const k = (otherLeader - otherRunnerUp) / (1 - w)
  if (d - k === 0) return [] // no crossing point by varying this criterion alone

  const breakevenWeight = k / (k - d)
  if (!Number.isFinite(breakevenWeight) || breakevenWeight <= 0 || breakevenWeight >= 1 || Math.abs(breakevenWeight - w) < 0.001) return []

  const criterion = criteria.find((c) => c.id === criterionId)
  const alt = alternatives.find((a) => a.id === runnerUp!.alternativeId)
  const direction = breakevenWeight > w ? 'increases' : 'decreases'

  return [
    {
      id: crypto.randomUUID(),
      kind: 'weight_change_reversal',
      description: `If "${criterion?.name ?? criterionId}" weight ${direction} from ${Math.round(w * 100)}% to ${Math.round(breakevenWeight * 100)}%, "${alt?.title ?? runnerUp!.alternativeId}" becomes preferable.`,
      affectedAlternativeIds: [leader!.alternativeId, runnerUp!.alternativeId],
    },
  ]
}

/** assumption_reversal_risk — only surfaced when the top two alternatives are close enough that an unverified assumption plausibly matters; every non-'known' assumption is named, since this model has no per-criterion assumption linkage to narrow it further (v1 — a real, honestly-scoped limitation, not a fabricated precision). */
function computeAssumptionReversalRisk(assumptions: DecisionAssumption[], weightedScores: WeightedScore[]): SensitivityInsight[] {
  const ranked = rankedAlternatives(weightedScores)
  if (ranked.length < 2) return []
  const [leader, runnerUp] = ranked
  if (leader!.totalScore - runnerUp!.totalScore > CLOSE_SCORE_THRESHOLD) return []

  return assumptions
    .filter((a) => a.origin !== 'known')
    .map((a) => ({
      id: crypto.randomUUID(),
      kind: 'assumption_reversal_risk' as const,
      description: `The recommendation is close (top two alternatives differ by ${(leader!.totalScore - runnerUp!.totalScore).toFixed(2)} points) — if the assumption "${a.statement}" turns out false, the recommendation could change.`,
      affectedAlternativeIds: [leader!.alternativeId, runnerUp!.alternativeId],
    }))
}

/** missing_information_impact — every explicit unknown is surfaced as a decision-impact gap, regardless of score closeness, since an unknown that wasn't even assessable couldn't be reflected in the scores at all (unlike an assumption, which was at least scored around). */
function computeMissingInformationImpact(unknowns: string[]): SensitivityInsight[] {
  return unknowns.map((u) => ({
    id: crypto.randomUUID(),
    kind: 'missing_information_impact' as const,
    description: `Missing information: ${u}`,
    affectedAlternativeIds: [],
  }))
}

/**
 * Decision Intelligence — the lightweight, deterministic sensitivity
 * layer the sprint brief calls for (Phase 6): "which criteria
 * materially influence the recommendation," "which assumptions could
 * reverse the recommendation," "which alternative becomes preferable
 * under changed weights," "which missing information has the greatest
 * decision impact." Explicitly not a full optimization engine — every
 * insight here is a bounded, explainable calculation over already-
 * computed weighted scores, not a search over the full decision space.
 */
export function computeSensitivity(params: {
  criteria: DecisionCriterion[]
  alternatives: Alternative[]
  evaluations: AlternativeEvaluation[]
  weightedScores: WeightedScore[]
  assumptions: DecisionAssumption[]
  unknowns: string[]
}): SensitivityInsight[] {
  const { criteria, alternatives, evaluations, weightedScores, assumptions, unknowns } = params
  const baselineTop = rankedAlternatives(weightedScores)[0]?.alternativeId ?? null

  return [
    ...computeCriterionInfluence(criteria, alternatives, evaluations, baselineTop),
    ...computeWeightChangeReversal(criteria, alternatives, weightedScores),
    ...computeAssumptionReversalRisk(assumptions, weightedScores),
    ...computeMissingInformationImpact(unknowns),
  ]
}
