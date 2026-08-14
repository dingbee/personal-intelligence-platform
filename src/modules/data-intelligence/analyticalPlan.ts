/**
 * Data Intelligence Foundation — the Analytical Query/Plan contract.
 *
 * Deliberately small and generic rather than one field per named metric:
 * "return rate", "discount rate", "share of orders by payment method",
 * and "top salesperson by sales" are all expressible as combinations of
 * filter + group + aggregate + ratio, not as separate hardcoded plan
 * shapes. This is what lets the same engine grow (conditional counts,
 * derived ratios, and — later — explicit period-over-period comparisons)
 * without breaking existing plans: a future addition is a new optional
 * field or a new `MeasureAggregation` value, never a schema rewrite.
 *
 * The LLM only ever proposes a value of this shape (see
 * api/parseAnalyticalPlanResponse.ts) — it never computes a result
 * itself. executeAnalyticalPlan.ts is the only code that reads dataset
 * rows and produces numbers.
 */

import type { CellValue } from '@/modules/processing/spreadsheet/types'

export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between'

export interface AnalyticalFilter {
  column: string
  op: ComparisonOperator
  /** A single value for eq/neq/gt/gte/lt/lte, an array of 2 for 'between', an array of any length for 'in'. */
  value: CellValue | CellValue[]
}

export type DateTruncUnit = 'year' | 'month'

export interface AnalyticalDimension {
  column: string
  /** Buckets a date column into a calendar period instead of grouping by its exact value. Column must be dataType:'date'. */
  dateTrunc?: DateTruncUnit
}

export type MeasureAggregation = 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max' | 'ratio'

/** One side of a ratio measure — an independent count/sum, optionally scoped by its own extra filters (e.g. "rows where Returns is truthy"). */
export interface RatioTerm {
  aggregation: 'sum' | 'count'
  /** Required when aggregation:'sum', ignored for 'count'. */
  column?: string
  filters?: AnalyticalFilter[]
}

export interface AnalyticalMeasure {
  /** Output field name this measure's value is reported under (see AnalyticalResultRow.measures). Must be unique within a plan. */
  as: string
  aggregation: MeasureAggregation
  /** Required for sum/avg/min/max/count_distinct; unused for count/ratio. */
  column?: string
  /**
   * Extra filters applied only to this measure, on top of the plan's own
   * `filters` — enables a "conditional count" (e.g. count of Returns=true
   * rows) without a second plan/execution. Ignored for aggregation:'ratio'
   * (use `ratio.numerator`/`ratio.denominator`'s own filters instead).
   */
  filters?: AnalyticalFilter[]
  /** Required when aggregation:'ratio'. numerator / denominator, e.g. return rate = count(Returns=true) / count(*). */
  ratio?: { numerator: RatioTerm; denominator: RatioTerm }
}

export interface AnalyticalPlan {
  datasetId: string
  /** Applied to every row before grouping/measuring. */
  filters?: AnalyticalFilter[]
  /** Group-by dimensions. Omitted or empty means "one group: the whole (filtered) dataset". */
  dimensions?: AnalyticalDimension[]
  measures: AnalyticalMeasure[]
  /** `by` must be a dimension column or a measure's `as`. */
  sort?: { by: string; direction: 'asc' | 'desc' }
  limit?: number
}

export interface AnalyticalResultRow {
  /** Keyed by dimension column name. When dateTrunc was used, the value is the truncated period string ('2024' or '2024-03'), not the raw cell value. */
  dimensions: Record<string, CellValue>
  /** Keyed by measure.as. null when a ratio's denominator was 0, or an aggregate had no non-null values to compute over — never NaN/Infinity. */
  measures: Record<string, number | null>
}

export type AnalyticalValidationErrorCode =
  | 'missing_dataset'
  | 'unknown_column'
  | 'incompatible_type'
  | 'ambiguous_measure'
  | 'unsupported_aggregation'

export interface AnalyticalValidationError {
  code: AnalyticalValidationErrorCode
  message: string
  column?: string
}

export interface AnalyticalProvenance {
  documentId: string
  sheetName: string
  sheetIndex: number
  totalRowsInDataset: number
  rowsMatchedAfterFilters: number
}

export type AnalyticalResult =
  | { status: 'ok'; plan: AnalyticalPlan; rows: AnalyticalResultRow[]; provenance: AnalyticalProvenance }
  | { status: 'error'; plan: AnalyticalPlan; error: AnalyticalValidationError }
