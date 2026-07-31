import { describe, expect, it } from 'vitest'
import { computeCategoryBreakdown, computeColumnStats, computeTrend, detectAnomalies } from '@/modules/processing/spreadsheet/aggregates'

// Columns: [Product, Region, Revenue]
const ROWS: unknown[][] = [
  ['Widget A', 'West', 1000],
  ['Widget B', 'East', 500],
  ['Widget C', 'West', 1500],
  ['Widget D', 'South', 200],
]

describe('computeColumnStats', () => {
  it('computes sum/average/min/max with row labels from the label column', () => {
    const stats = computeColumnStats(ROWS, 'Revenue', 2, 0)
    expect(stats).toEqual({
      column: 'Revenue',
      sum: 3200,
      average: 800,
      min: { value: 200, label: 'Widget D' },
      max: { value: 1500, label: 'Widget C' },
    })
  })

  it('parses currency-formatted text cells', () => {
    const rows = [['A', '$1,000.50'], ['B', '$250']]
    const stats = computeColumnStats(rows, 'Amount', 1, 0)
    expect(stats?.sum).toBeCloseTo(1250.5)
  })

  it('returns null when the column has no numeric values at all', () => {
    expect(computeColumnStats([['x', 'not a number']], 'Revenue', 1, null)).toBeNull()
  })
})

describe('computeCategoryBreakdown', () => {
  it('groups by category, sums the value column, sorts descending, and identifies best/worst', () => {
    const result = computeCategoryBreakdown(ROWS, 'Region', 1, 'Revenue', 2)
    expect(result?.breakdown).toEqual([
      { category: 'West', total: 2500 },
      { category: 'East', total: 500 },
      { category: 'South', total: 200 },
    ])
    expect(result?.best).toEqual({ category: 'West', total: 2500 })
    expect(result?.worst).toEqual({ category: 'South', total: 200 })
  })
})

describe('computeTrend', () => {
  it('groups by calendar month and computes growth rate from first to last period', () => {
    const rows: unknown[][] = [
      ['2025-01-05', 100],
      ['2025-01-20', 100],
      ['2025-06-10', 300],
    ]
    const trend = computeTrend(rows, 'Date', 0, 'Revenue', 1)
    expect(trend?.periods).toEqual([
      { period: '2025-01', total: 200 },
      { period: '2025-06', total: 300 },
    ])
    expect(trend?.growthRatePercent).toBeCloseTo(50)
  })

  it('returns null when no rows have both a valid date and a valid value', () => {
    expect(computeTrend([['not a date', 100]], 'Date', 0, 'Revenue', 1)).toBeNull()
  })
})

describe('detectAnomalies', () => {
  it('flags a value more than 2 standard deviations from the mean', () => {
    const rows: unknown[][] = [['A', 100], ['B', 105], ['C', 95], ['D', 102], ['E', 98], ['F', 5000]]
    const anomalies = detectAnomalies(rows, 'Revenue', 1, 0)
    expect(anomalies.length).toBeGreaterThan(0)
    expect(anomalies[0]!.rowLabel).toBe('F')
    expect(anomalies[0]!.value).toBe(5000)
  })

  it('returns an empty list when values are uniform (zero stddev) or too few', () => {
    expect(detectAnomalies([['A', 100], ['B', 100]], 'Revenue', 1, 0)).toEqual([])
  })
})
