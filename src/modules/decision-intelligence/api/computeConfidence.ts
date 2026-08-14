import type { AlternativeEvaluation } from '@/modules/decision-intelligence/decision'

export interface ConfidenceResult {
  confidence: 'low' | 'medium' | 'high' | null
  provisional: boolean
  provisionalReason: string | null
}

/**
 * Decision Intelligence — the deterministic confidence/provisional rule
 * the sprint brief's Phase 5 asks for: "A high-confidence recommendation
 * should require stronger evidence than a low-confidence recommendation
 * ... where important information is missing, the system should
 * explicitly say 'Decision is provisional because...' rather than
 * inventing information." Two independent, explainable rules — never a
 * black-box score:
 *
 *   1. A model-claimed 'high' confidence is capped to 'medium' unless
 *      real evidence was retrieved AND at least one evaluation of the
 *      recommended alternative actually cites it. This is a real
 *      requirement, not a heuristic guess: "high confidence" backed by
 *      nothing but the model's own qualitative impression is exactly
 *      the "unsupported certainty" validateDecision.ts also flags.
 *   2. Any unresolved `unknowns` makes the decision provisional,
 *      regardless of confidence — an explicit gap the recommendation
 *      could not account for.
 *
 * Both reasons are surfaced together when both apply, never silently
 * dropped.
 */
export function computeConfidence(params: {
  declaredConfidence: 'low' | 'medium' | 'high' | null
  recommendedAlternativeId: string | null
  evaluations: AlternativeEvaluation[]
  contextEvidenceCount: number
  unknowns: string[]
}): ConfidenceResult {
  const { declaredConfidence, recommendedAlternativeId, evaluations, contextEvidenceCount, unknowns } = params

  const recommendedHasEvidence = evaluations.some((e) => e.alternativeId === recommendedAlternativeId && e.evidenceIds.length > 0)
  const reasons: string[] = []
  let confidence = declaredConfidence

  if (declaredConfidence === 'high' && (contextEvidenceCount === 0 || !recommendedHasEvidence)) {
    confidence = 'medium'
    reasons.push('high confidence was claimed without cited evidence backing the recommended alternative, so it was capped to medium')
  }

  if (unknowns.length > 0) {
    const preview = unknowns.slice(0, 3).join('; ')
    reasons.push(`${unknowns.length} piece(s) of information remain unknown (${preview}${unknowns.length > 3 ? ', …' : ''})`)
  }

  return {
    confidence,
    provisional: reasons.length > 0,
    provisionalReason: reasons.length > 0 ? `Decision is provisional because ${reasons.join('; and ')}.` : null,
  }
}
