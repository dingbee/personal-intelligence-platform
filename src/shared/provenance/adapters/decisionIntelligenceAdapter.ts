import type { Decision, DecisionContextSource, DecisionContextSourceType } from '@/modules/decision-intelligence/decision'
import { analysisInvestigationToProvenance } from '@/shared/provenance/adapters/analysisIntelligenceAdapter'
import type { DerivationReference, EvidenceReference, ProvenanceChain, SourceReference, SourceType } from '@/shared/provenance/types'

// Decision.contextEvidence's own DecisionContextSourceType maps onto the shared model's own
// SourceType, identical to planningIntelligenceAdapter.ts's mapping — 'dataset_investigation' maps
// to 'dataset', the same tag Data/Analysis/Research Intelligence's own adapters already use for a
// structured_datasets sheet (researchIntelligenceAdapter.ts's identical mapping).
const SOURCE_TYPE_MAP: Record<DecisionContextSourceType, SourceType> = { document: 'document', note: 'note', asset: 'asset', dataset_investigation: 'dataset' }

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

  // When this decision delegated to Analysis Intelligence for a real, deterministic number
  // (buildDecisionContext.ts), splice in that investigation's OWN provenance chain — real
  // cross-engine reuse, not reimplementation, mirroring researchIntelligenceAdapter.ts's
  // identical Data -> Analysis splice exactly. Any evaluation that cited the resulting
  // dataset_investigation evidence item links back to it via basedOnDerivationIds below.
  let nestedSynthesisDerivationId: string | null = null
  const datasetEvidenceId = decision.contextEvidence.find((item) => item.type === 'dataset_investigation')?.id ?? null
  if (decision.datasetInvestigation) {
    const nested = analysisInvestigationToProvenance(decision.datasetInvestigation)
    evidence.push(...nested.evidence)
    derivations.push(...nested.derivations)
    nestedSynthesisDerivationId = `analysis:${decision.datasetInvestigation.id}:synthesis`
    if (!derivations.some((d) => d.id === nestedSynthesisDerivationId)) nestedSynthesisDerivationId = null
  }

  for (const evaluation of decision.evaluations) {
    if (evaluation.evidenceIds.length === 0) continue
    const alternative = decision.alternatives.find((a) => a.id === evaluation.alternativeId)
    const criterion = decision.criteria.find((c) => c.id === evaluation.criterionId)
    const derivationId = `decision:${decision.id}:evaluation:${evaluation.alternativeId}:${evaluation.criterionId}`
    const citesDatasetInvestigation = datasetEvidenceId !== null && evaluation.evidenceIds.includes(datasetEvidenceId)
    derivations.push({
      id: derivationId,
      kind: 'observation',
      evidenceIds: evaluation.evidenceIds,
      basedOnDerivationIds: citesDatasetInvestigation && nestedSynthesisDerivationId ? [nestedSynthesisDerivationId] : [],
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
