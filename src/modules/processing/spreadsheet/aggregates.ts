import type { Anomaly, CategoryBreakdown, ColumnStats, TrendAnalysis } from '@/modules/processing/spreadsheet/types'
import { isNonEmptyCell, parseDateValue, parseNumericValue } from '@/modules/processing/spreadsheet/cellParsing'

const MAX_CATEGORY_ROWS = 10
const MAX_ANOMALIES = 5
const ANOMALY_STDDEV_THRESHOLD = 2

function cellLabel(row: unknown[], labelColumnIndex: number | null): string | null {
  if (labelColumnIndex === null) return null
  const value = row[labelColumnIndex]
  return isNonEmptyCell(value) ? String(value) : null
}

/** UX-13.10 — the "basic calculations layer": sum/average/min/max only, no formula engine. `dataRows` excludes the header row. */
export function computeColumnStats(dataRows: unknown[][], columnName: string, columnIndex: number, labelColumnIndex: number | null): ColumnStats | null {
  let sum = 0
  let count = 0
  let min: { value: number; label: string | null } | null = null
  let max: { value: number; label: string | null } | null = null

  for (const row of dataRows) {
    const parsed = parseNumericValue(row[columnIndex])
    if (parsed === null) continue
    sum += parsed
    count += 1
    const label = cellLabel(row, labelColumnIndex)
    if (min === null || parsed < min.value) min = { value: parsed, label }
    if (max === null || parsed > max.value) max = { value: parsed, label }
  }

  if (count === 0 || min === null || max === null) return null
  return { column: columnName, sum, average: sum / count, min, max }
}

export function computeCategoryBreakdown(
  dataRows: unknown[][],
  categoryColumnName: string,
  categoryColumnIndex: number,
  valueColumnName: string,
  valueColumnIndex: number,
): CategoryBreakdown | null {
  const totals = new Map<string, number>()
  for (const row of dataRows) {
    const category = row[categoryColumnIndex]
    const value = parseNumericValue(row[valueColumnIndex])
    if (!isNonEmptyCell(category) || value === null) continue
    const key = String(category)
    totals.set(key, (totals.get(key) ?? 0) + value)
  }
  if (totals.size === 0) return null

  const sorted = [...totals.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
  return {
    categoryColumn: categoryColumnName,
    valueColumn: valueColumnName,
    breakdown: sorted.slice(0, MAX_CATEGORY_ROWS),
    best: sorted[0] ?? null,
    worst: sorted[sorted.length - 1] ?? null,
  }
}

export function computeTrend(
  dataRows: unknown[][],
  dateColumnName: string,
  dateColumnIndex: number,
  valueColumnName: string,
  valueColumnIndex: number,
): TrendAnalysis | null {
  const totals = new Map<string, number>()
  for (const row of dataRows) {
    const iso = parseDateValue(row[dateColumnIndex])
    const value = parseNumericValue(row[valueColumnIndex])
    if (iso === null || value === null) continue
    const period = iso.slice(0, 7) // YYYY-MM
    totals.set(period, (totals.get(period) ?? 0) + value)
  }
  if (totals.size === 0) return null

  const periods = [...totals.entries()].map(([period, total]) => ({ period, total })).sort((a, b) => a.period.localeCompare(b.period))
  const first = periods[0]!.total
  const last = periods[periods.length - 1]!.total
  const growthRatePercent = periods.length >= 2 && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null

  return { dateColumn: dateColumnName, valueColumn: valueColumnName, periods, growthRatePercent }
}

/** Simple z-score outliers — not a statistics engine, just enough to answer "find anomalies" for a single numeric column. */
export function detectAnomalies(dataRows: unknown[][], columnName: string, columnIndex: number, labelColumnIndex: number | null): Anomaly[] {
  const points: { value: number; label: string | null }[] = []
  for (const row of dataRows) {
    const value = parseNumericValue(row[columnIndex])
    if (value === null) continue
    points.push({ value, label: cellLabel(row, labelColumnIndex) })
  }
  if (points.length < 3) return []

  const mean = points.reduce((sum, p) => sum + p.value, 0) / points.length
  const variance = points.reduce((sum, p) => sum + (p.value - mean) ** 2, 0) / points.length
  const stddev = Math.sqrt(variance)
  if (stddev === 0) return []

  return points
    .map((p) => ({ column: columnName, rowLabel: p.label, value: p.value, deviation: Math.abs(p.value - mean) / stddev }))
    .filter((a) => a.deviation > ANOMALY_STDDEV_THRESHOLD)
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, MAX_ANOMALIES)
}
