import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'
import { analyticalResultToProvenance } from '@/shared/provenance/adapters/dataIntelligenceAdapter'
import type { DerivationReference, EvidenceReference, ProvenanceChain } from '@/shared/provenance/types'

/**
 * Analysis Intelligence -> shared provenance adapter. Reuses the Data
 * Intelligence adapter directly, once per step — the same "Analysis never
 * recomputes, only orchestrates Data" discipline the engine itself follows
 * (analysisInvestigation.ts's own doc comment), now also true of its
 * provenance. Each step's Observations become 'observation' derivations
 * based on that step's calculation derivation; the investigation's final
 * synthesis (once complete) becomes one closing 'synthesis' derivation
 * based on every step's observation derivations — the CONCLUSION of the
 * chain.
 *
 * A step with `result.status === 'error'` contributes nothing (mirrors
 * extractObservations.ts's own "a failed step contributes no evidence"
 * rule — analyticalResultToProvenance already returns null for it, so
 * this adapter simply has nothing to add for that step).
 */
export function analysisInvestigationToProvenance(investigation: AnalysisInvestigation): ProvenanceChain {
  const evidence: EvidenceReference[] = []
  const derivations: DerivationReference[] = []
  const observationDerivationIds: string[] = []

  for (const step of investigation.steps) {
    const base = analyticalResultToProvenance(step.result)
    if (!base) continue

    evidence.push(base.evidence)
    derivations.push(base.derivation)

    for (const observation of step.observations) {
      const derivationId = `analysis:${observation.id}`
      derivations.push({
        id: derivationId,
        kind: 'observation',
        evidenceIds: [base.evidence.id],
        basedOnDerivationIds: [base.derivation.id],
        statement: observation.statement,
        method: null,
      })
      observationDerivationIds.push(derivationId)
    }
  }

  if (investigation.synthesis && observationDerivationIds.length > 0) {
    derivations.push({
      id: `analysis:${investigation.id}:synthesis`,
      kind: 'synthesis',
      evidenceIds: [],
      basedOnDerivationIds: observationDerivationIds,
      statement: investigation.synthesis,
      method: null,
    })
  }

  return { evidence, derivations }
}
