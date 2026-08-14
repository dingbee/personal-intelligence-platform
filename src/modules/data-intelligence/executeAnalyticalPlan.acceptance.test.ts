import { describe, expect, it } from 'vitest'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'
import { executeAnalyticalPlan } from '@/modules/data-intelligence/executeAnalyticalPlan'
import { withPercentOfTotal, withSequentialGrowth } from '@/modules/data-intelligence/resultDerivatives'
import type { StructuredDataset } from '@/modules/data-intelligence/api/structuredDatasets'
import type { CellValue } from '@/modules/processing/spreadsheet/types'
import type { AnalyticalPlan, AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'
import { EXPECTED, PRODUCT_SALES_DATA_ROWS, PRODUCT_SALES_ROWS } from '@/modules/data-intelligence/__fixtures__/productSalesWorkbook'
import { analyticalResultToProvenance } from '@/shared/provenance/adapters/dataIntelligenceAdapter'

/**
 * ARRIYIA Professional Intelligence — Data Intelligence Foundation
 * benchmark acceptance test. Maps the audit's Product Sales Excel
 * benchmark (docs/intelligence-architecture-reconciliation-audit.md
 * §10, rows 1–12 and 14 — row 13, correlation, is deliberately excluded
 * as Analysis Intelligence, out of scope this phase) onto
 * executeAnalyticalPlan, run against productSalesWorkbook.ts's fixture.
 *
 * Every EXPECTED value in the fixture was independently computed by a
 * standalone script using plain Map/reduce arithmetic over the same raw
 * row data — never by calling executeAnalyticalPlan or any code in this
 * module — so a bug shared between the engine and its test cannot hide
 * inside a matching wrong answer. This is the deterministic-execution
 * counterpart of "before vs after": these are the exact question types
 * that were architecturally unanswerable before this phase (audit §8) —
 * "the complete dataset does not survive past processing" — and are
 * computed here from the complete persisted grid.
 */
function buildDataset(): StructuredDataset {
  const analysis = analyzeSheet(PRODUCT_SALES_ROWS, 0, 'Sales')
  return {
    id: 'dataset-1',
    documentId: 'document-1',
    userId: 'user-1',
    workspaceId: null,
    sheetIndex: 0,
    sheetName: 'Sales',
    columns: analysis.columns,
    rows: PRODUCT_SALES_DATA_ROWS as CellValue[][],
    rowCount: PRODUCT_SALES_DATA_ROWS.length,
    columnCount: analysis.columns.length,
  }
}

function ok(result: AnalyticalResult) {
  if (result.status !== 'ok') throw new Error(`Expected ok, got error: ${result.error.message}`)
  return result
}

function measureByDimension(result: AnalyticalResult, dimension: string, measure: string): Record<string, number | null> {
  const { rows } = ok(result)
  return Object.fromEntries(rows.map((r) => [String(r.dimensions[dimension]), r.measures[measure] ?? null]))
}

describe('Data Intelligence Foundation — Product Sales benchmark acceptance', () => {
  const dataset = buildDataset()

  it('schema sanity — Order Date/Delivery Date are date columns, Total Price is numeric', () => {
    const byName = Object.fromEntries(dataset.columns.map((c) => [c.name, c]))
    expect(byName['Order Date']?.dataType).toBe('date')
    expect(byName['Delivery Date']?.dataType).toBe('date')
    expect(['number', 'currency']).toContain(byName['Total Price']?.dataType)
  })

  it('Row 1 — which salesperson generated the most total sales', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Salesperson' }],
      measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }],
      sort: { by: 'totalSales', direction: 'desc' },
      limit: 1,
    }
    const result = ok(executeAnalyticalPlan(dataset, plan))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.dimensions.Salesperson).toBe(EXPECTED.topSalespersonBySales)
    expect(result.rows[0]!.measures.totalSales).toBe(EXPECTED.totalSalesBySalesperson.Alice)

    const unlimited = ok(
      executeAnalyticalPlan(dataset, { datasetId: dataset.id, dimensions: [{ column: 'Salesperson' }], measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }] }),
    )
    expect(measureByDimension(unlimited, 'Salesperson', 'totalSales')).toEqual(EXPECTED.totalSalesBySalesperson)
  })

  it('Provenance Foundation — Row 1\'s result identifies its originating dataset/sheet via the shared provenance model, without changing the computed answer', () => {
    const result = executeAnalyticalPlan(dataset, {
      datasetId: dataset.id,
      dimensions: [{ column: 'Salesperson' }],
      measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }],
      sort: { by: 'totalSales', direction: 'desc' },
      limit: 1,
    })
    const provenance = analyticalResultToProvenance(result)
    expect(provenance).not.toBeNull()
    expect(provenance!.evidence.source).toEqual({ type: 'dataset', id: 'document-1', title: 'Sales' })
    expect(provenance!.evidence.location).toEqual({ kind: 'rows', sheetName: 'Sales', sheetIndex: 0, rowCount: 30 })
    // The adapter never recomputes — the underlying answer is unchanged.
    expect(ok(result).rows[0]!.measures.totalSales).toBe(EXPECTED.totalSalesBySalesperson.Alice)
  })

  it('Row 2 — return rate by region', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Region' }],
      measures: [
        {
          as: 'returnRate',
          aggregation: 'ratio',
          ratio: {
            numerator: { aggregation: 'count', filters: [{ column: 'Returned', op: 'eq', value: true }] },
            denominator: { aggregation: 'count' },
          },
        },
      ],
    }
    const result = executeAnalyticalPlan(dataset, plan)
    expect(measureByDimension(result, 'Region', 'returnRate')).toEqual(EXPECTED.returnRateByRegion)
  })

  it('Row 3 — return rate by product', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Product' }],
      measures: [
        {
          as: 'returnRate',
          aggregation: 'ratio',
          ratio: {
            numerator: { aggregation: 'count', filters: [{ column: 'Returned', op: 'eq', value: true }] },
            denominator: { aggregation: 'count' },
          },
        },
      ],
    }
    const result = executeAnalyticalPlan(dataset, plan)
    expect(measureByDimension(result, 'Product', 'returnRate')).toEqual(EXPECTED.returnRateByProduct)
  })

  it('Row 4 — Retail vs Wholesale total sales comparison', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Customer Type' }],
      measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }],
    }
    const result = executeAnalyticalPlan(dataset, plan)
    expect(measureByDimension(result, 'Customer Type', 'totalSales')).toEqual(EXPECTED.salesByCustomerType)
  })

  it('Row 5 — annual sales, 2023 vs 2024 vs 2025 (partial year)', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Order Date', dateTrunc: 'year' }],
      measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }],
      sort: { by: 'Order Date', direction: 'asc' },
    }
    const result = ok(executeAnalyticalPlan(dataset, plan))
    expect(measureByDimension(result, 'Order Date', 'totalSales')).toEqual(EXPECTED.salesByYear)

    // Growth is a deterministic post-processing pass over the already-executed result, not a new plan primitive.
    const withGrowth = withSequentialGrowth(result.rows, 'totalSales')
    const growth2024 = ((EXPECTED.salesByYear['2024'] - EXPECTED.salesByYear['2023']) / EXPECTED.salesByYear['2023']) * 100
    expect(withGrowth[1]!.measures.totalSalesGrowthPercent).toBeCloseTo(growth2024, 10)
  })

  it('Row 6 — monthly sales totals', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Order Date', dateTrunc: 'month' }],
      measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }],
    }
    const result = executeAnalyticalPlan(dataset, plan)
    expect(measureByDimension(result, 'Order Date', 'totalSales')['2023-01']).toBe(EXPECTED.salesByMonthJan2023)
  })

  it('Row 7 — monthly sales by region (multi-dimensional grouping)', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Region' }, { column: 'Order Date', dateTrunc: 'month' }],
      measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }],
    }
    const result = ok(executeAnalyticalPlan(dataset, plan))
    const row = result.rows.find((r) => r.dimensions.Region === 'North' && r.dimensions['Order Date'] === '2023-01')
    expect(row?.measures.totalSales).toBe(EXPECTED.salesByRegionMonthNorth202301)
  })

  it('Row 8 — average delivery time by store', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Store' }],
      measures: [{ as: 'avgDeliveryDays', aggregation: 'avg', column: 'Delivery Days' }],
    }
    const result = executeAnalyticalPlan(dataset, plan)
    const byStore = measureByDimension(result, 'Store', 'avgDeliveryDays')
    expect(byStore.Store1).toBeCloseTo(EXPECTED.avgDeliveryDaysByStore.Store1, 10)
    expect(byStore.Store2).toBeCloseTo(EXPECTED.avgDeliveryDaysByStore.Store2, 10)
  })

  it('Row 9 — share of orders by payment method', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Payment' }],
      measures: [{ as: 'orderCount', aggregation: 'count' }],
    }
    const result = ok(executeAnalyticalPlan(dataset, plan))
    const withShare = withPercentOfTotal(result.rows, 'orderCount')
    const share = Object.fromEntries(withShare.map((r) => [String(r.dimensions.Payment), r.measures.orderCountPercentOfTotal]))
    expect(share.Card).toBeCloseTo(EXPECTED.paymentSharePercent.Card, 10)
    expect(share.Cash).toBeCloseTo(EXPECTED.paymentSharePercent.Cash, 10)
  })

  it('Row 10 — discount rate by product (sum(Discount)/sum(Unit Price))', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Product' }],
      measures: [
        {
          as: 'discountRate',
          aggregation: 'ratio',
          ratio: { numerator: { aggregation: 'sum', column: 'Discount' }, denominator: { aggregation: 'sum', column: 'Unit Price' } },
        },
      ],
    }
    const result = executeAnalyticalPlan(dataset, plan)
    const byProduct = measureByDimension(result, 'Product', 'discountRate')
    expect(byProduct.Widget).toBeCloseTo(EXPECTED.discountRateByProduct.Widget, 10)
    expect(byProduct.Gadget).toBeCloseTo(EXPECTED.discountRateByProduct.Gadget, 10)
  })

  it('Row 11 — promoted vs non-promoted average order value', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Promotion' }],
      measures: [{ as: 'avgOrderValue', aggregation: 'avg', column: 'Total Price' }],
    }
    const result = executeAnalyticalPlan(dataset, plan)
    const byPromotion = measureByDimension(result, 'Promotion', 'avgOrderValue')
    expect(byPromotion.true).toBeCloseTo(EXPECTED.avgOrderValuePromoted, 10)
    expect(byPromotion.false).toBeCloseTo(EXPECTED.avgOrderValueNonPromoted, 10)
  })

  it('Row 12 — top stores by revenue, H1 2025', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      filters: [{ column: 'Order Date', op: 'between', value: ['2025-01-01', '2025-06-30'] }],
      dimensions: [{ column: 'Store' }],
      measures: [{ as: 'revenue', aggregation: 'sum', column: 'Total Price' }],
      sort: { by: 'revenue', direction: 'desc' },
      limit: 5,
    }
    const result = ok(executeAnalyticalPlan(dataset, plan))
    expect(result.provenance.rowsMatchedAfterFilters).toBe(EXPECTED.h1_2025_rowCount)
    expect(measureByDimension(result, 'Store', 'revenue')).toEqual(EXPECTED.h1_2025_revenueByStore)
  })

  it('Row 14 — salesperson with the highest return rate', () => {
    const plan: AnalyticalPlan = {
      datasetId: dataset.id,
      dimensions: [{ column: 'Salesperson' }],
      measures: [
        {
          as: 'returnRate',
          aggregation: 'ratio',
          ratio: {
            numerator: { aggregation: 'count', filters: [{ column: 'Returned', op: 'eq', value: true }] },
            denominator: { aggregation: 'count' },
          },
        },
      ],
      sort: { by: 'returnRate', direction: 'desc' },
      limit: 1,
    }
    const result = ok(executeAnalyticalPlan(dataset, plan))
    expect(result.rows[0]!.dimensions.Salesperson).toBe('Carol')
    expect(result.rows[0]!.measures.returnRate).toBeCloseTo(EXPECTED.returnRateBySalesperson.Carol, 10)
  })

  describe('failure modes', () => {
    it('missing column → unknown_column', () => {
      const result = executeAnalyticalPlan(dataset, { datasetId: dataset.id, measures: [{ as: 'x', aggregation: 'sum', column: 'Not A Real Column' }] })
      expect(result.status).toBe('error')
      expect(result.status === 'error' && result.error.code).toBe('unknown_column')
    })

    it('invalid aggregation → unsupported_aggregation', () => {
      const result = executeAnalyticalPlan(dataset, {
        datasetId: dataset.id,
        // @ts-expect-error deliberately invalid — simulating a malformed LLM plan response
        measures: [{ as: 'x', aggregation: 'median', column: 'Total Price' }],
      })
      expect(result.status).toBe('error')
      expect(result.status === 'error' && result.error.code).toBe('unsupported_aggregation')
    })

    it('ambiguous measure (sum with no column) → ambiguous_measure', () => {
      const result = executeAnalyticalPlan(dataset, { datasetId: dataset.id, measures: [{ as: 'x', aggregation: 'sum' }] })
      expect(result.status).toBe('error')
      expect(result.status === 'error' && result.error.code).toBe('ambiguous_measure')
    })

    it('incompatible type (sum over a category column) → incompatible_type', () => {
      const result = executeAnalyticalPlan(dataset, { datasetId: dataset.id, measures: [{ as: 'x', aggregation: 'sum', column: 'Region' }] })
      expect(result.status).toBe('error')
      expect(result.status === 'error' && result.error.code).toBe('incompatible_type')
    })

    it('empty filter result → ok with zero rows matched, not an error', () => {
      const result = ok(
        executeAnalyticalPlan(dataset, {
          datasetId: dataset.id,
          filters: [{ column: 'Region', op: 'eq', value: 'Nonexistent Region' }],
          measures: [{ as: 'count', aggregation: 'count' }],
        }),
      )
      expect(result.provenance.rowsMatchedAfterFilters).toBe(0)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]!.measures.count).toBe(0)
    })

    it('unknown sort field → unknown_column', () => {
      const result = executeAnalyticalPlan(dataset, {
        datasetId: dataset.id,
        measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }],
        sort: { by: 'NotAField', direction: 'desc' },
      })
      expect(result.status).toBe('error')
      expect(result.status === 'error' && result.error.code).toBe('unknown_column')
    })
  })
})
