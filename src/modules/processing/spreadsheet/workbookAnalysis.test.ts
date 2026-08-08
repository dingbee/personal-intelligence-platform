import { describe, expect, it } from 'vitest'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'

// Matches the worked example from the spec: Customer, Date, Revenue, Region, Product.
const SALES_ROWS: unknown[][] = [
  ['Customer', 'Date', 'Revenue', 'Region', 'Product'],
  ['Acme Co', '2025-01-10', '$1,000', 'West', 'Widget A'],
  ['Globex', '2025-01-15', '$500', 'East', 'Widget B'],
  ['Acme Co', '2025-06-01', '$2,000', 'West', 'Widget A'],
  ['Initech', '2025-06-20', '$300', 'South', 'Widget C'],
]

describe('analyzeSheet', () => {
  it('detects columns, meanings, pattern, currency, date range, and aggregates for a sales sheet', () => {
    const result = analyzeSheet(SALES_ROWS, 0, 'Sales')

    expect(result.rowCount).toBe(4)
    expect(result.columnCount).toBe(5)
    expect(result.pattern).toBe('sales-data')
    expect(result.currency).toBe('USD')
    expect(result.dateRange).toEqual({ start: '2025-01-10', end: '2025-06-20' })

    const revenueCol = result.columns.find((c) => c.name === 'Revenue')
    expect(revenueCol?.dataType).toBe('currency')
    expect(revenueCol?.meaning).toBe('currency')

    const customerCol = result.columns.find((c) => c.name === 'Customer')
    expect(customerCol?.meaning).toBe('entity')

    // Basic calculations layer: sum/average/min/max on the currency column.
    const stats = result.aggregates.columnStats.find((s) => s.column === 'Revenue')
    expect(stats?.sum).toBe(3800)

    // Category comparison: Revenue by Region, best performer.
    const regionBreakdown = result.aggregates.categoryBreakdowns.find((b) => b.categoryColumn === 'Region')
    expect(regionBreakdown?.best?.category).toBe('West')
    expect(regionBreakdown?.best?.total).toBe(3000)

    // Trend: Revenue by month, with growth rate.
    expect(result.aggregates.trends).toHaveLength(1)
    expect(result.aggregates.trends[0]!.periods.length).toBeGreaterThanOrEqual(1)
  })

  it('handles an empty data sheet (header only) without throwing — pattern is still header-derived', () => {
    const result = analyzeSheet([['Notes', 'Comment']], 0, 'Empty')
    expect(result.rowCount).toBe(0)
    expect(result.aggregates.columnStats).toEqual([])
    expect(result.pattern).toBe('unknown')
  })

  it('handles a completely empty sheet (no rows at all) without throwing', () => {
    const result = analyzeSheet([], 0, 'Blank')
    expect(result.rowCount).toBe(0)
    expect(result.columnCount).toBe(0)
  })

  describe('Sprint 3/10 — breakdown fixes', () => {
    const MONTH_ROWS: unknown[][] = [
      ['Month', 'Product', 'Revenue', 'Cost'],
      ['Jan', 'A', 100, 60],
      ['Feb', 'A', 200, 90],
    ]

    it('groups by a bare month-name column ("Jan"/"Feb", no year) even though it never resolves to a real date', () => {
      const result = analyzeSheet(MONTH_ROWS, 0, 'Sales')

      const monthColumn = result.columns.find((c) => c.name === 'Month')
      expect(monthColumn?.meaning).toBe('timeline')
      expect(monthColumn?.dataType).not.toBe('date') // no year present — parseDateValue can't resolve it
      expect(result.dateRange).toBeNull() // honest: no fabricated date range from a partial label

      const revenueByMonth = result.aggregates.categoryBreakdowns.find((b) => b.categoryColumn === 'Month' && b.valueColumn === 'Revenue')
      expect(revenueByMonth?.best).toEqual({ category: 'Feb', total: 200 })
    })

    it('computes a breakdown for every numeric column, not only the first ("primary") one', () => {
      const result = analyzeSheet(MONTH_ROWS, 0, 'Sales')

      const revenueByProduct = result.aggregates.categoryBreakdowns.find((b) => b.categoryColumn === 'Product' && b.valueColumn === 'Revenue')
      const costByProduct = result.aggregates.categoryBreakdowns.find((b) => b.categoryColumn === 'Product' && b.valueColumn === 'Cost')
      expect(revenueByProduct?.best).toEqual({ category: 'A', total: 300 })
      expect(costByProduct?.best).toEqual({ category: 'A', total: 150 })
    })

    it('does not double up: a genuine full-date column is still covered by trends, not also duplicated as a per-exact-date breakdown', () => {
      const result = analyzeSheet(SALES_ROWS, 0, 'Sales')
      const dateBreakdown = result.aggregates.categoryBreakdowns.find((b) => b.categoryColumn === 'Date')
      expect(dateBreakdown).toBeUndefined()
      expect(result.aggregates.trends).toHaveLength(1)
    })
  })
})
