import type { SheetAnalysis } from '@/modules/processing/spreadsheet/types'

export interface WorkbookSummary {
  sheetCount: number
  totalRows: number
  /** Human-readable badges for the Library summary card, e.g. "Sales Data", "Customer Records" — independent boolean checks over what was actually detected, not a 1:1 mirror of each sheet's single `pattern`. */
  detectedLabels: string[]
  period: { start: string; end: string } | null
  currency: string | null
}

const PATTERN_LABELS: Record<string, string> = {
  'income-statement': 'Income Statement',
  'expense-sheet': 'Expense Tracking',
  inventory: 'Inventory',
  'customer-sheet': 'Customer Records',
  'sales-data': 'Sales Data',
}

/** UX-13.10 — "Spreadsheet Summary Card": rolls per-sheet SheetAnalysis[] into the workbook-level figures the Library card and Document Detail page display. Pure aggregation over already-computed data, no new detection logic. */
export function summarizeWorkbook(analyses: SheetAnalysis[]): WorkbookSummary {
  const labels = new Set<string>()
  for (const sheet of analyses) {
    const label = PATTERN_LABELS[sheet.pattern]
    if (label) labels.add(label)
    const hasEntity = sheet.columns.some((c) => c.meaning === 'entity')
    const hasCurrency = sheet.columns.some((c) => c.meaning === 'currency')
    if (hasCurrency) labels.add('Revenue Tracking')
    if (hasEntity && hasCurrency) labels.add('Customer Records')
  }

  const ranges = analyses.map((s) => s.dateRange).filter((r): r is NonNullable<typeof r> => r !== null)
  const period =
    ranges.length > 0
      ? { start: ranges.reduce((a, b) => (a.start < b.start ? a : b)).start, end: ranges.reduce((a, b) => (a.end > b.end ? a : b)).end }
      : null

  const currency = analyses.find((s) => s.currency !== null)?.currency ?? null

  return {
    sheetCount: analyses.length,
    totalRows: analyses.reduce((sum, s) => sum + s.rowCount, 0),
    detectedLabels: [...labels],
    period,
    currency,
  }
}
