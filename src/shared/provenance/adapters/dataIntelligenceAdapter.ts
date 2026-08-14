import type { AnalyticalMeasure, AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'
import type { DerivationReference, EvidenceReference } from '@/shared/provenance/types'

function describeMeasure(measure: AnalyticalMeasure): string {
  if (measure.aggregation === 'ratio') return `${measure.as} = ratio`
  if (measure.aggregation === 'count') return `${measure.as} = count`
  return `${measure.as} = ${measure.aggregation}(${measure.column ?? '?'})`
}

/**
 * Data Intelligence -> shared provenance adapter. Maps an already-computed
 * AnalyticalResult (from the unmodified executeAnalyticalPlan.ts — this
 * adapter never computes anything itself, only relabels a result Data
 * Intelligence already produced) into one EvidenceReference (the dataset/
 * sheet/rows-matched summary AnalyticalProvenance already carries) and one
 * DerivationReference (kind:'calculation', the deterministic aggregation
 * that was performed — `method` is a real, reconstructible description of
 * the plan's measures, not a guess).
 *
 * Returns null for a failed result: a validation error contributed no
 * evidence and no derivation, matching the "a failed step contributes
 * nothing, never a fabricated one" discipline every consumer of
 * AnalyticalResult already follows (extractObservations.ts, Research
 * Intelligence's dataset-delegation handling, ...).
 */
export function analyticalResultToProvenance(result: AnalyticalResult): { evidence: EvidenceReference; derivation: DerivationReference } | null {
  if (result.status === 'error') return null

  const { plan, provenance } = result
  const evidenceId = `data:${provenance.documentId}:${provenance.sheetIndex}`

  const evidence: EvidenceReference = {
    id: evidenceId,
    source: { type: 'dataset', id: provenance.documentId, title: provenance.sheetName },
    location: { kind: 'rows', sheetName: provenance.sheetName, sheetIndex: provenance.sheetIndex, rowCount: provenance.rowsMatchedAfterFilters },
    excerpt: null,
    retrievedAt: null,
  }

  const derivation: DerivationReference = {
    id: `${evidenceId}:calc`,
    kind: 'calculation',
    evidenceIds: [evidenceId],
    basedOnDerivationIds: [],
    statement: `Computed over ${provenance.rowsMatchedAfterFilters} of ${provenance.totalRowsInDataset} rows in "${provenance.sheetName}": ${plan.measures.map(describeMeasure).join(', ')}.`,
    method: plan.measures.map(describeMeasure).join('; '),
  }

  return { evidence, derivation }
}
