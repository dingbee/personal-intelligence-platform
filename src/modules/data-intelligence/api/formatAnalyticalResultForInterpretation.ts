import type { AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

/**
 * Data Intelligence Foundation — turns a validated AnalyticalResult (the
 * deterministic engine's output) into the plain-text block the
 * interpretation capability's prompt is grounded in. This is the only
 * thing the interpretation call ever sees about the dataset — it never
 * receives raw rows, so it cannot substitute its own calculation for
 * what's given here.
 *
 * An empty `rows` array (0 matches) is formatted as an explicit,
 * honest statement rather than an empty block, so the interpretation
 * step says "no matching data" plainly (epistemic case B) instead of
 * inventing something to say.
 */
export function formatAnalyticalResultForInterpretation(result: AnalyticalResult): string {
  if (result.status === 'error') {
    return `VALIDATION ERROR — the plan could not be executed: ${result.error.message}\nNo data was computed. Do not guess or estimate a number; explain plainly what went wrong.`
  }

  const { rows, provenance } = result
  const provenanceLine = `Source: sheet "${provenance.sheetName}" of the uploaded dataset — ${provenance.rowsMatchedAfterFilters} of ${provenance.totalRowsInDataset} total rows matched the applied filters.`

  if (rows.length === 0) {
    return `${provenanceLine}\n\nNo rows matched. State plainly that there is no matching data — do not invent a result.`
  }

  const rowLines = rows.map((row) => {
    const dims = Object.entries(row.dimensions)
      .map(([k, v]) => `${k}=${v ?? 'null'}`)
      .join(', ')
    const measures = Object.entries(row.measures)
      .map(([k, v]) => `${k}=${v === null ? 'null (not computable)' : v}`)
      .join(', ')
    return dims ? `${dims} — ${measures}` : measures
  })

  return `${provenanceLine}\n\nComputed result (${rows.length} row${rows.length === 1 ? '' : 's'}):\n${rowLines.join('\n')}`
}
