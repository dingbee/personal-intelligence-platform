/** UX-13.10 Spreadsheet Intelligence v1 — all shapes here are plain JSON (no Date objects, no functions), since SheetAnalysis[] is persisted verbatim into extraction_metadata.metadata.spreadsheet (jsonb). */

export type ColumnDataType = 'number' | 'currency' | 'date' | 'category' | 'text'

export type ColumnMeaning = 'entity' | 'timeline' | 'currency' | 'category' | 'identifier' | 'metric' | 'text'

export interface ColumnAnalysis {
  name: string
  columnIndex: number
  dataType: ColumnDataType
  meaning: ColumnMeaning
  hasFormulas: boolean
  distinctCount: number
  nonEmptyCount: number
}

export type FinancialPattern = 'income-statement' | 'expense-sheet' | 'inventory' | 'customer-sheet' | 'sales-data' | 'unknown'

export interface ColumnStats {
  column: string
  sum: number
  average: number
  min: { value: number; label: string | null }
  max: { value: number; label: string | null }
}

export interface CategoryBreakdown {
  categoryColumn: string
  valueColumn: string
  /** Sorted descending by total, capped — see aggregates.ts. */
  breakdown: { category: string; total: number }[]
  best: { category: string; total: number } | null
  worst: { category: string; total: number } | null
}

export interface TrendAnalysis {
  dateColumn: string
  valueColumn: string
  /** One entry per calendar month present in the data, chronological. */
  periods: { period: string; total: number }[]
  /** (last - first) / |first| * 100, or null when there's fewer than 2 periods or the first period is 0. */
  growthRatePercent: number | null
}

export interface Anomaly {
  column: string
  rowLabel: string | null
  value: number
  /** How many standard deviations from the column mean, always positive. */
  deviation: number
}

export interface SheetAggregates {
  columnStats: ColumnStats[]
  categoryBreakdowns: CategoryBreakdown[]
  trends: TrendAnalysis[]
  anomalies: Anomaly[]
}

export interface SheetAnalysis {
  sheetIndex: number
  sheetName: string
  rowCount: number
  columnCount: number
  columns: ColumnAnalysis[]
  pattern: FinancialPattern
  /** ISO 4217 code (e.g. 'USD'), or null when no currency symbol/code evidence was found — never guessed. */
  currency: string | null
  dateRange: { start: string; end: string } | null
  aggregates: SheetAggregates
}

/**
 * Data Intelligence Foundation — a single cell's value after extraction,
 * normalized to a JSON-safe primitive so a sheet's full grid can be
 * persisted verbatim (no Date objects, no functions — SheetJS never
 * produces either here since `spreadsheet.ts` reads cells without the
 * `cellDates` option; a date cell arrives as its Excel serial number,
 * parseable via `excelSerialToIsoDate`/`parseDateValue`).
 */
export type CellValue = string | number | boolean | null

/**
 * Data Intelligence Foundation — the complete row/column grid for one
 * sheet, built from the exact same typed `rows` array `analyzeSheet`
 * already computes `SheetAnalysis` from (see spreadsheet.ts's `extract`),
 * so the schema (`columns`) and the deterministic-query substrate
 * (`rows`) can never disagree about what a column means. `rows` excludes
 * the header row and is in the same column order as `columns`.
 */
export interface StructuredSheet {
  sheetIndex: number
  sheetName: string
  columns: ColumnAnalysis[]
  rows: CellValue[][]
  rowCount: number
}
