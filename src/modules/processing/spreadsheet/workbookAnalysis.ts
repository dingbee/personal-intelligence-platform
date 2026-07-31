import type { ColumnAnalysis, SheetAggregates, SheetAnalysis } from '@/modules/processing/spreadsheet/types'
import { detectColumnMeaning, detectColumnType, detectCurrencySymbol } from '@/modules/processing/spreadsheet/columnAnalysis'
import { computeCategoryBreakdown, computeColumnStats, computeTrend, detectAnomalies } from '@/modules/processing/spreadsheet/aggregates'
import { classifyFinancialPattern } from '@/modules/processing/spreadsheet/financialPatterns'
import { isNonEmptyCell, parseDateValue } from '@/modules/processing/spreadsheet/cellParsing'

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
  const categoryColumns = columns.filter((c) => c.meaning === 'category')
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

  const categoryBreakdowns = primaryNumericColumn
    ? categoryColumns
        .filter((c) => c.columnIndex !== primaryNumericColumn.columnIndex)
        .map((c) => computeCategoryBreakdown(dataRows, c.name, c.columnIndex, primaryNumericColumn.name, primaryNumericColumn.columnIndex))
        .filter((b): b is NonNullable<typeof b> => b !== null)
    : []

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
