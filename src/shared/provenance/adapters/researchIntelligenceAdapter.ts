import type { ResearchInvestigation, ResearchSource, ResearchSourceType } from '@/modules/research-intelligence/researchInvestigation'
import { analysisInvestigationToProvenance } from '@/shared/provenance/adapters/analysisIntelligenceAdapter'
import type { DerivationReference, EvidenceReference, ProvenanceChain, SourceReference, SourceType } from '@/shared/provenance/types'

// Research Intelligence's own ResearchSourceType ('document'|'note'|'asset'|
// 'dataset_investigation') is a specialized subset of the shared SourceType —
// 'dataset_investigation' has no direct shared-model equivalent (it names an
// *investigation*, not a stored source), so it maps to 'dataset', the same tag
// Data Intelligence's own adapter uses for the structured_datasets sheet the
// delegated investigation ultimately read from. 'asset' (Multimodal Evidence
// Integration sprint) maps 1:1 onto the shared model's own pre-existing 'asset'
// SourceType — no new tag was needed. This is Option C from the sprint brief
// ("remain specialized views over the shared model") — ResearchSource/
// ResearchEvidence are NOT changed or aliased away; this file only adds a
// one-way mapping outward.
const SOURCE_TYPE_MAP: Record<ResearchSourceType, SourceType> = {
  document: 'document',
  note: 'note',
  asset: 'asset',
  dataset_investigation: 'dataset',
}

function toSourceReference(source: ResearchSource): SourceReference {
  return { type: SOURCE_TYPE_MAP[source.type], id: source.id, title: source.title }
}

/**
 * Research Intelligence -> shared provenance adapter. Every ResearchEvidence
 * item becomes an EvidenceReference (verbatim excerpt preserved, never
 * paraphrased — the same source-integrity discipline gatherEvidence.ts
 * itself enforces); every ResearchObservation becomes an 'observation'
 * derivation citing the real evidence ids its `evidenceIds` already named
 * (never re-validated here — parseResearchObservationsResponse.ts already
 * guarantees they're real). A `dataset_investigation` step additionally
 * splices in the nested AnalysisInvestigation's OWN provenance chain via
 * analysisIntelligenceAdapter (real cross-engine reuse, not
 * reimplementation) and links the research-level observation derivations
 * for that step to the nested investigation's own synthesis derivation via
 * `basedOnDerivationIds` — a genuine three-engine chain: Data -> Analysis
 * -> Research, traceable in one structure.
 *
 * The investigation's final synthesis, once complete, becomes the closing
 * 'synthesis' derivation (the CONCLUSION), based on every step's
 * observation derivations.
 */
export function researchInvestigationToProvenance(investigation: ResearchInvestigation): ProvenanceChain {
  const evidence: EvidenceReference[] = []
  const derivations: DerivationReference[] = []
  const observationDerivationIds: string[] = []

  for (const step of investigation.steps) {
    let nestedSynthesisDerivationId: string | null = null

    if (step.kind === 'dataset_investigation' && step.datasetInvestigation) {
      const nested = analysisInvestigationToProvenance(step.datasetInvestigation)
      evidence.push(...nested.evidence)
      derivations.push(...nested.derivations)
      nestedSynthesisDerivationId = `analysis:${step.datasetInvestigation.id}:synthesis`
      if (!derivations.some((d) => d.id === nestedSynthesisDerivationId)) nestedSynthesisDerivationId = null
    }

    // For an 'asset' source, this deliberately does NOT call
    // assetAnalysisToProvenance (assetAdapter.ts) a second time: gatherEvidence.ts
    // never receives the raw AssetAnalysis back from retrieveAssetContext (only
    // its already-serialized excerpt text — see gatherEvidence.ts's own doc
    // comment on why a second fetch is avoided), so there is nothing to
    // reconstruct it from without duplicating asset retrieval. The shape
    // produced below — {source:{type:'asset',...}, location:{kind:'whole'},
    // excerpt} — is intentionally identical to assetAnalysisToProvenance's own
    // `evidence` field, so this is not a second/different asset provenance
    // shape, just the same generic per-item mapping every other Research
    // source (document/note) already goes through here.
    for (const item of step.evidence) {
      evidence.push({
        id: item.id,
        source: toSourceReference(item.source),
        location: { kind: 'whole' },
        excerpt: item.excerpt,
        retrievedAt: null,
      })
    }

    for (const observation of step.observations) {
      const derivationId = `research:${observation.id}`
      derivations.push({
        id: derivationId,
        kind: 'observation',
        evidenceIds: observation.evidenceIds,
        basedOnDerivationIds: nestedSynthesisDerivationId ? [nestedSynthesisDerivationId] : [],
        statement: observation.statement,
        method: null,
      })
      observationDerivationIds.push(derivationId)
    }
  }

  if (investigation.synthesis && observationDerivationIds.length > 0) {
    derivations.push({
      id: `research:${investigation.id}:synthesis`,
      kind: 'synthesis',
      evidenceIds: [],
      basedOnDerivationIds: observationDerivationIds,
      statement: investigation.synthesis,
      method: null,
    })
  }

  return { evidence, derivations }
}
