import type { Decision, DecisionContextSource, DecisionContextSourceType } from '@/modules/decision-intelligence/decision'
import type { DerivationReference, EvidenceReference, ProvenanceChain, SourceReference, SourceType } from '@/shared/provenance/types'

// Decision.contextEvidence's own DecisionContextSourceType ('document'|'note'|'asset') maps 1:1
// onto the shared model's own SourceType, identical to planningIntelligenceAdapter.ts's mapping.
const SOURCE_TYPE_MAP: Record<DecisionContextSourceType, SourceType> = { document: 'document', note: 'note', asset: 'asset' }

function toSourceReference(source: DecisionContextSource): SourceReference {
  return { type: SOURCE_TYPE_MAP[source.type], id: source.id, title: source.title }
}

/**
 * Decision Intelligence -> shared provenance adapter, mirroring
 * planningIntelligenceAdapter.ts's own structure. Unlike Planning
 * (which had no per-claim citations and produced one plan-level
 * synthesis derivation), Decision's evaluations DO carry real per-item
 * evidenceIds (see parseDecisionResponse.ts's evidenceNumbers
 * resolution) — so this adapter produces one 'observation' derivation
 * per evidence-backed evaluation (a genuine, specific claim: "this
 * alternative scores N on this criterion, because...") plus a single
 * 'synthesis' derivation for the final recommendation, based on those
 * observations. An evaluation with no cited evidence contributes no
 * derivation at all — never a derivation grounded in nothing, matching
 * the shared model's own invariant.
 */
export function decisionToProvenance(decision: Decision): ProvenanceChain {
  const evidence: EvidenceReference[] = decision.contextEvidence.map((item) => ({
    id: item.id,
    source: toSourceReference(item),
    location: { kind: 'whole' },
    excerpt: item.excerpt,
    retrievedAt: null,
  }))

  const derivations: DerivationReference[] = []
  const observationDerivationIds: string[] = []

  for (const evaluation of decision.evaluations) {
    if (evaluation.evidenceIds.length === 0) continue
    const alternative = decision.alternatives.find((a) => a.id === evaluation.alternativeId)
    const criterion = decision.criteria.find((c) => c.id === evaluation.criterionId)
    const derivationId = `decision:${decision.id}:evaluation:${evaluation.alternativeId}:${evaluation.criterionId}`
    derivations.push({
      id: derivationId,
      kind: 'observation',
      evidenceIds: evaluation.evidenceIds,
      basedOnDerivationIds: [],
      statement: `${alternative?.title ?? evaluation.alternativeId} scores ${evaluation.score}/10 on ${criterion?.name ?? evaluation.criterionId}: ${evaluation.rationale}`,
      method: null,
    })
    observationDerivationIds.push(derivationId)
  }

  if (decision.status === 'complete' && decision.rationale && observationDerivationIds.length > 0) {
    derivations.push({
      id: `decision:${decision.id}:synthesis`,
      kind: 'synthesis',
      evidenceIds: [],
      basedOnDerivationIds: observationDerivationIds,
      statement: decision.rationale,
      method: null,
    })
  }

  return { evidence, derivations }
}
