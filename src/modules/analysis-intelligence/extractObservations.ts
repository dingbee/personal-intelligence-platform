import type { AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'
import type { Observation } from '@/modules/analysis-intelligence/analysisInvestigation'

/** Defensive cap — a step's plan can in principle return many groups; this bounds how many individual Observations one step contributes, so an investigation can't grow unboundedly wide even from a single step. The step planner is instructed to use reasonable limits/aggregation itself; this is a backstop, not the primary control. */
const MAX_OBSERVATIONS_PER_STEP = 10

function formatRow(dimensions: Record<string, unknown>, measures: Record<string, number | null>): string {
  const dims = Object.entries(dimensions)
    .map(([k, v]) => `${k}=${v ?? 'null'}`)
    .join(', ')
  const measureText = Object.entries(measures)
    .map(([k, v]) => `${k}=${v === null ? 'null (not computable)' : v}`)
    .join(', ')
  return dims ? `${dims} — ${measureText}` : measureText
}

/**
 * Analysis Intelligence — turns one step's already-validated
 * AnalyticalResult into explicit, traceable Observation[]. This is the
 * ONLY place raw result rows are read to produce an Observation; the
 * synthesis step never sees rows directly, only these already-extracted
 * statements — the same "LLM never touches the numbers" discipline Data
 * Intelligence already applies to its own interpretation step, held one
 * layer up.
 *
 * A failed step (`result.status === 'error'`) contributes zero
 * observations — never a fabricated one. An empty-but-valid result (0
 * matching rows) still produces exactly one Observation stating that
 * plainly, since "no evidence of X" is itself evidence, not a failure.
 */
export function extractObservations(step: { id: string; result: AnalyticalResult }): Observation[] {
  const { id: stepId, result } = step
  if (result.status === 'error') return []

  const { rows, provenance, plan } = result
  const singleMeasure = plan.measures.length === 1 ? plan.measures[0]!.as : null

  if (rows.length === 0) {
    return [
      {
        id: crypto.randomUUID(),
        stepId,
        statement: `No rows matched (0 of ${provenance.totalRowsInDataset} total rows, sheet "${provenance.sheetName}").`,
        value: null,
        provenance,
      },
    ]
  }

  return rows.slice(0, MAX_OBSERVATIONS_PER_STEP).map((row) => ({
    id: crypto.randomUUID(),
    stepId,
    statement: formatRow(row.dimensions, row.measures),
    value: singleMeasure ? (row.measures[singleMeasure] ?? null) : null,
    provenance,
  }))
}
