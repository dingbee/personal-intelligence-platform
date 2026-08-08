import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { csvProcessor, xlsxProcessor } from '@/modules/processing/extractors/spreadsheet'
import { SALES_ROWS } from '@/modules/processing/spreadsheet/__fixtures__/salesExpensesWorkbook'

function workbookBlob(sheets: { name: string; rows: unknown[][] }[]): Blob {
  const workbook = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  }
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([bytes])
}

/**
 * PIP Sprint 3/10, Phase 11 — end-to-end coverage for the actual file →
 * chapters/analysis boundary. workbookAnalysis.test.ts already covers
 * analyzeSheet in isolation; this proves the real XLSX.read path (sheet
 * discovery, markdown serialization, formula-column detection off the raw
 * WorkSheet) produces the same result, since nothing upstream of this had
 * a test before this sprint.
 */
describe('xlsxProcessor.extract', () => {
  it('extracts one chapter and one SheetAnalysis per sheet, matching the sheet name', async () => {
    const blob = workbookBlob([{ name: 'Sales', rows: SALES_ROWS }])
    const result = await xlsxProcessor.extract(blob)

    expect(result.chapters!).toHaveLength(1)
    expect(result.chapters![0]!.title).toBe('Sales')
    expect(result.chapters![0]!.text).toContain('Revenue')
    expect(result.chapters![0]!.text).toContain('10000')
    expect(result.pageCount).toBe(1)

    expect(result.spreadsheetAnalysis).toHaveLength(1)
    const analysis = result.spreadsheetAnalysis![0]!
    expect(analysis.sheetName).toBe('Sales')
    expect(analysis.rowCount).toBe(6)
    const revenueStats = analysis.aggregates.columnStats.find((s) => s.column === 'Revenue')
    expect(revenueStats?.sum).toBe(57000)
  })

  it('extracts one chapter and one SheetAnalysis per sheet across multiple sheets, in order', async () => {
    const blob = workbookBlob([
      { name: 'Sales', rows: SALES_ROWS },
      { name: 'Expenses', rows: [['Month', 'Department', 'Expense'], ['Jan', 'Operations', 2500]] },
    ])
    const result = await xlsxProcessor.extract(blob)

    expect(result.chapters!.map((c) => c.title)).toEqual(['Sales', 'Expenses'])
    expect(result.spreadsheetAnalysis!.map((a) => a.sheetName)).toEqual(['Sales', 'Expenses'])
    expect(result.spreadsheetAnalysis![1]!.rowCount).toBe(1)
  })

  it('detects a formula column from the raw worksheet and reports the last-saved value in the text', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Item', 'Price', 'Qty', 'Total'],
      ['Widget', 10, 3, 30],
    ])
    // A formula cell needs an explicit `f` (formula) alongside a cached
    // `v` — SheetJS drops a formula-only cell with no value, and this
    // extractor never recalculates (see spreadsheet.ts's own doc comment).
    sheet['D2'] = { t: 'n', v: 30, f: 'B2*C2' }
    XLSX.utils.book_append_sheet(workbook, sheet, 'Order')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const result = await xlsxProcessor.extract(new Blob([bytes]))

    expect(result.chapters![0]!.text).toContain('30')
    const totalColumn = result.spreadsheetAnalysis![0]!.columns.find((c) => c.name === 'Total')
    expect(totalColumn?.hasFormulas).toBe(true)
    const priceColumn = result.spreadsheetAnalysis![0]!.columns.find((c) => c.name === 'Price')
    expect(priceColumn?.hasFormulas).toBe(false)
  })

  it('handles a header-only sheet without throwing', async () => {
    const blob = workbookBlob([{ name: 'Empty', rows: [['Notes', 'Comment']] }])
    const result = await xlsxProcessor.extract(blob)
    // A header-only sheet serializes to a non-blank markdown table (the
    // header row itself), so it's kept, with zero analyzed data rows.
    expect(result.spreadsheetAnalysis![0]?.rowCount).toBe(0)
  })
})

describe('csvProcessor.extract', () => {
  it('parses a real CSV file the same way as an XLSX sheet', async () => {
    const csv = 'Month,Product,Revenue\nJan,A,10000\nFeb,A,12000\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const result = await csvProcessor.extract(blob)

    expect(result.chapters!).toHaveLength(1)
    expect(result.spreadsheetAnalysis).toHaveLength(1)
    const revenueStats = result.spreadsheetAnalysis![0]!.aggregates.columnStats.find((s) => s.column === 'Revenue')
    expect(revenueStats?.sum).toBe(22000)
  })
})
