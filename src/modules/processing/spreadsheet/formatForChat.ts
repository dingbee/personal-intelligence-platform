import type { SheetAnalysis } from '@/modules/processing/spreadsheet/types'

function formatMoney(value: number, currency: string | null): string {
  const rounded = Math.round(value * 100) / 100
  return currency ? `${currency} ${rounded.toLocaleString()}` : rounded.toLocaleString()
}

/**
 * UX-13.10 — formats precomputed, deterministic figures into the same
 * "grounding block" shape buildSystemPrompt already appends for graph/
 * memory context (see retrieveGraphContext). The point: when Chat answers
 * "what were the largest expenses" it reads these already-correct numbers
 * instead of re-deriving them from a raw chunk of markdown-table text —
 * same reasoning as the Unified Intelligence Pipeline fix for chapter
 * summaries, applied at generation time instead of after the fact.
 */
export function formatSpreadsheetContextText(analyses: SheetAnalysis[]): string | null {
  if (analyses.length === 0) return null

  const lines: string[] = []
  for (const sheet of analyses) {
    lines.push(`Sheet: ${sheet.sheetName} (${sheet.rowCount.toLocaleString()} rows, ${sheet.columnCount} columns)`)
    if (sheet.pattern !== 'unknown') lines.push(`Detected pattern: ${sheet.pattern}`)
    if (sheet.dateRange) lines.push(`Period: ${sheet.dateRange.start} to ${sheet.dateRange.end}`)
    lines.push(`Columns: ${sheet.columns.map((c) => `${c.name} (${c.meaning})`).join(', ')}`)

    for (const stat of sheet.aggregates.columnStats) {
      const minLabel = stat.min.label ? ` (row: ${stat.min.label})` : ''
      const maxLabel = stat.max.label ? ` (row: ${stat.max.label})` : ''
      lines.push(
        `${stat.column}: sum ${formatMoney(stat.sum, sheet.currency)}, average ${formatMoney(stat.average, sheet.currency)}, ` +
          `min ${formatMoney(stat.min.value, sheet.currency)}${minLabel}, max ${formatMoney(stat.max.value, sheet.currency)}${maxLabel}`,
      )
    }

    for (const breakdown of sheet.aggregates.categoryBreakdowns) {
      lines.push(`${breakdown.valueColumn} by ${breakdown.categoryColumn}:`)
      for (const row of breakdown.breakdown) lines.push(`- ${row.category}: ${formatMoney(row.total, sheet.currency)}`)
      if (breakdown.best && breakdown.worst && breakdown.best.category !== breakdown.worst.category) {
        lines.push(
          `Best: ${breakdown.best.category} (${formatMoney(breakdown.best.total, sheet.currency)}). ` +
            `Worst: ${breakdown.worst.category} (${formatMoney(breakdown.worst.total, sheet.currency)}).`,
        )
      }
    }

    for (const trend of sheet.aggregates.trends) {
      lines.push(`${trend.valueColumn} trend by month (${trend.dateColumn}):`)
      for (const period of trend.periods) lines.push(`${period.period}: ${formatMoney(period.total, sheet.currency)}`)
      if (trend.growthRatePercent !== null) {
        lines.push(`Growth: ${trend.growthRatePercent >= 0 ? '+' : ''}${trend.growthRatePercent.toFixed(1)}% from first to last period.`)
      }
    }

    if (sheet.aggregates.anomalies.length > 0) {
      lines.push(`Anomalies in ${sheet.aggregates.anomalies[0]!.column}:`)
      for (const anomaly of sheet.aggregates.anomalies) {
        const label = anomaly.rowLabel ? `Row "${anomaly.rowLabel}"` : 'A row'
        lines.push(`- ${label}: ${formatMoney(anomaly.value, sheet.currency)} (${anomaly.deviation.toFixed(1)} std deviations from the mean)`)
      }
    }

    lines.push('')
  }

  return lines.join('\n').trim()
}
