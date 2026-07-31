import { describe, expect, it } from 'vitest'
import { formatSpreadsheetContextText } from '@/modules/processing/spreadsheet/formatForChat'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'

const SALES_ROWS: unknown[][] = [
  ['Customer', 'Date', 'Revenue', 'Region'],
  ['Acme Co', '2025-01-10', '$1,000', 'West'],
  ['Globex', '2025-01-15', '$500', 'East'],
]

describe('formatSpreadsheetContextText', () => {
  it('returns null for an empty analysis list', () => {
    expect(formatSpreadsheetContextText([])).toBeNull()
  })

  it('includes the sheet name, pattern, computed sum, and best-category comparison', () => {
    const analysis = analyzeSheet(SALES_ROWS, 0, 'Sales')
    const text = formatSpreadsheetContextText([analysis])

    expect(text).toContain('Sheet: Sales')
    expect(text).toContain('sales-data')
    expect(text).toContain('Revenue: sum USD 1,500')
    expect(text).toContain('Best: West')
  })
})
