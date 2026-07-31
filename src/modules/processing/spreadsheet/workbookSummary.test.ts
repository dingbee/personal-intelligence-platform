import { describe, expect, it } from 'vitest'
import { summarizeWorkbook } from '@/modules/processing/spreadsheet/workbookSummary'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'

const SALES_ROWS: unknown[][] = [
  ['Customer', 'Date', 'Revenue', 'Region'],
  ['Acme Co', '2025-01-10', '$1,000', 'West'],
  ['Globex', '2025-12-15', '$500', 'East'],
]

describe('summarizeWorkbook', () => {
  it('rolls up sheet count, total rows, detected labels, period, and currency from the worked example', () => {
    const summary = summarizeWorkbook([analyzeSheet(SALES_ROWS, 0, 'Sales')])

    expect(summary.sheetCount).toBe(1)
    expect(summary.totalRows).toBe(2)
    expect(summary.detectedLabels).toEqual(expect.arrayContaining(['Sales Data', 'Revenue Tracking', 'Customer Records']))
    expect(summary.period).toEqual({ start: '2025-01-10', end: '2025-12-15' })
    expect(summary.currency).toBe('USD')
  })

  it('handles a workbook with no financial signal at all', () => {
    const summary = summarizeWorkbook([analyzeSheet([['Notes'], ['just some text']], 0, 'Misc')])
    expect(summary.detectedLabels).toEqual([])
    expect(summary.period).toBeNull()
    expect(summary.currency).toBeNull()
  })
})
