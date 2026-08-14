import type { AnalyticalResultRow } from '@/modules/data-intelligence/analyticalPlan'

/**
 * Data Intelligence Foundation — generic post-processing over an
 * already-executed, already-validated grouped result. Deliberately kept
 * out of the AnalyticalPlan/executeAnalyticalPlan contract: "share of
 * total" and "period-over-period growth" are derived views of verified
 * numbers, not new aggregation primitives, so they never touch dataset
 * rows and can't introduce a new way to misread the data. Pure arithmetic
 * over `AnalyticalResultRow[]`, same discipline as the engine itself —
 * the LLM never computes these either.
 */

/** Adds a percent-of-total field for `measureKey` to every row (e.g. "share of orders by payment method"). */
export function withPercentOfTotal(rows: AnalyticalResultRow[], measureKey: string, asKey: string = `${measureKey}PercentOfTotal`): AnalyticalResultRow[] {
  const total = rows.reduce((sum, row) => sum + (row.measures[measureKey] ?? 0), 0)
  return rows.map((row) => ({
    ...row,
    measures: { ...row.measures, [asKey]: total === 0 ? null : ((row.measures[measureKey] ?? 0) / total) * 100 },
  }))
}

/**
 * Adds a period-over-period growth-percent field for `measureKey`,
 * comparing each row to the previous one in array order (e.g.
 * year-over-year or month-over-month sales growth). The caller is
 * responsible for the rows already being in chronological order — this
 * function does no sorting or date interpretation of its own.
 */
export function withSequentialGrowth(rows: AnalyticalResultRow[], measureKey: string, asKey: string = `${measureKey}GrowthPercent`): AnalyticalResultRow[] {
  return rows.map((row, i) => {
    if (i === 0) return { ...row, measures: { ...row.measures, [asKey]: null } }
    const prev = rows[i - 1]!.measures[measureKey]
    const curr = row.measures[measureKey]
    const growth = prev === null || prev === undefined || prev === 0 || curr === null || curr === undefined ? null : ((curr - prev) / Math.abs(prev)) * 100
    return { ...row, measures: { ...row.measures, [asKey]: growth } }
  })
}
