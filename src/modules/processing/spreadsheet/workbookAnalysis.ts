import type { ColumnAnalysis, SheetAggregates, SheetAnalysis } from '@/modules/processing/spreadsheet/types'
import { detectColumnMeaning, detectColumnType, detectCurrencySymbol } from '@/modules/processing/spreadsheet/columnAnalysis'
import { computeCategoryBreakdown, computeColumnStats, computeTrend, detectAnomalies } from '@/modules/processing/spreadsheet/aggregates'
import { classifyFinancialPattern } from '@/modules/processing/spreadsheet/financialPatterns'
import { isNonEmptyCell, parseDateValue } from '@/modules/processing/spreadsheet/cellParsing'

/** Sprint 3/10 — a sheet's own row cap per breakdown (MAX_CATEGORY_ROWS in aggregates.ts) already bounds each breakdown's size; this bounds how many (category column x numeric column) breakdowns a single sheet can produce, so a wide sheet with many category-like and numeric columns can't blow up the grounding text. */
const MAX_BREAKDOWNS_PER_SHEET = 20

function pickLabelColumnIndex(columns: ColumnAnalysis[]): number | null {
  const entity = columns.find((c) => c.meaning === 'entity')
  if (entity) return entity.columnIndex
  const category = columns.find((c) => c.meaning === 'category')
  if (category) return category.columnIndex
  const identifier = columns.find((c) => c.meaning === 'identifier')
  return identifier?.columnIndex ?? null
}

/**
 * UX-13.10 Spreadsheet Intelligence v1 — the "Workbook Understanding" +
 * "Basic Calculations" + "Financial Pattern Recognition" pieces, all pure
 * and deterministic. Takes the raw typed grid SheetJS already produces
 * (`sheet_to_json(sheet, {header: 1})`) — the same array spreadsheet.ts's
 * extractor discards after serializing to markdown — so nothing here
 * re-parses the file. `formulaColumnIndexes` is best-effort (extractor
 * supplies it from the raw WorkSheet when cheap to compute; omit it and
 * every column's `hasFormulas` is simply false).
 */
export function analyzeSheet(rows: unknown[][], sheetIndex: number, sheetName: string, formulaColumnIndexes: ReadonlySet<number> = new Set()): SheetAnalysis {
  const header = (rows[0] ?? []).map((h, i) => (isNonEmptyCell(h) ? String(h) : `Column ${i + 1}`))
  const dataRows = rows.slice(1)

  const columns: ColumnAnalysis[] = header.map((name, columnIndex) => {
    const values = dataRows.map((row) => row[columnIndex])
    const dataType = detectColumnType(name, values)
    const nonEmpty = values.filter(isNonEmptyCell)
    return {
      name,
      columnIndex,
      dataType,
      meaning: detectColumnMeaning(name, dataType),
      hasFormulas: formulaColumnIndexes.has(columnIndex),
      distinctCount: new Set(nonEmpty.map((v) => String(v).toLowerCase().trim())).size,
      nonEmptyCount: nonEmpty.length,
    }
  })

  const labelColumnIndex = pickLabelColumnIndex(columns)
  const numericColumns = columns.filter((c) => c.dataType === 'currency' || c.dataType === 'number')
  // Sprint 3/10 — a header like "Month" always gets meaning 'timeline'
  // (detectColumnMeaning matches the header regex before it ever looks at
  // dataType), but real-world period labels like "Jan"/"Feb"/"Mar" don't
  // parse as absolute dates (no year), so they fall through to dataType
  // 'category' rather than 'date'. Without this, a plain monthly column
  // was silently excluded from every breakdown — "which month had the
  // highest revenue" had nothing to group by. Genuine date columns
  // (dataType 'date') are left out here since they're already covered by
  // the month-grouped `trends` below; this only rescues the case where
  // detection landed on 'timeline' meaning but not a real date.
  const categoryColumns = columns.filter((c) => c.meaning === 'category' || (c.meaning === 'timeline' && c.dataType !== 'date'))
  const dateColumn = columns.find((c) => c.dataType === 'date') ?? null
  const primaryNumericColumn = numericColumns.find((c) => c.dataType === 'currency') ?? numericColumns[0] ?? null

  const currencyColumn = columns.find((c) => c.dataType === 'currency')
  const currency = currencyColumn ? detectCurrencySymbol(currencyColumn.name, dataRows.map((r) => r[currencyColumn.columnIndex])) : null

  let dateRange: { start: string; end: string } | null = null
  if (dateColumn) {
    const isoDates = dataRows.map((r) => parseDateValue(r[dateColumn.columnIndex])).filter((d): d is string => d !== null)
    if (isoDates.length > 0) {
      dateRange = { start: isoDates.reduce((a, b) => (a < b ? a : b)), end: isoDates.reduce((a, b) => (a > b ? a : b)) }
    }
  }

  const columnStats = numericColumns
    .map((c) => computeColumnStats(dataRows, c.name, c.columnIndex, labelColumnIndex))
    .filter((s): s is NonNullable<typeof s> => s !== null)

  // Sprint 3/10 — every numeric column gets its own breakdown per category
  // column, not just the single "primary" one. With Revenue and Cost both
  // present, grouping only Revenue by Product left Cost-by-Product (needed
  // to answer "which product had the highest gross profit") entirely
  // unavailable to the model, forcing it to reconstruct per-product cost
  // from prose instead of reading it directly.
  const categoryBreakdowns = categoryColumns
    .flatMap((categoryColumn) =>
      numericColumns
        .filter((numericColumn) => numericColumn.columnIndex !== categoryColumn.columnIndex)
        .map((numericColumn) =>
          computeCategoryBreakdown(dataRows, categoryColumn.name, categoryColumn.columnIndex, numericColumn.name, numericColumn.columnIndex),
        ),
    )
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .slice(0, MAX_BREAKDOWNS_PER_SHEET)

  const trends: SheetAggregates['trends'] = []
  if (dateColumn && primaryNumericColumn) {
    const trend = computeTrend(dataRows, dateColumn.name, dateColumn.columnIndex, primaryNumericColumn.name, primaryNumericColumn.columnIndex)
    if (trend) trends.push(trend)
  }

  const anomalies = primaryNumericColumn ? detectAnomalies(dataRows, primaryNumericColumn.name, primaryNumericColumn.columnIndex, labelColumnIndex) : []

  return {
    sheetIndex,
    sheetName,
    rowCount: dataRows.length,
    columnCount: header.length,
    columns,
    pattern: classifyFinancialPattern(columns),
    currency,
    dateRange,
    aggregates: { columnStats, categoryBreakdowns, trends, anomalies },
  }
}
