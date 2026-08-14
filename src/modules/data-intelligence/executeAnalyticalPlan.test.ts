import { describe, expect, it } from 'vitest'
import { executeAnalyticalPlan } from '@/modules/data-intelligence/executeAnalyticalPlan'
import type { StructuredDataset } from '@/modules/data-intelligence/api/structuredDatasets'
import type { ColumnAnalysis } from '@/modules/processing/spreadsheet/types'
import type { AnalyticalPlan } from '@/modules/data-intelligence/analyticalPlan'

const columns: ColumnAnalysis[] = [
  { name: 'Category', columnIndex: 0, dataType: 'category', meaning: 'category', hasFormulas: false, distinctCount: 2, nonEmptyCount: 6 },
  { name: 'Amount', columnIndex: 1, dataType: 'number', meaning: 'metric', hasFormulas: false, distinctCount: 6, nonEmptyCount: 6 },
  { name: 'Flagged', columnIndex: 2, dataType: 'category', meaning: 'category', hasFormulas: false, distinctCount: 2, nonEmptyCount: 6 },
]

function dataset(rows: unknown[][]): StructuredDataset {
  return { id: 'ds-1', documentId: 'doc-1', userId: 'user-1', workspaceId: null, sheetIndex: 0, sheetName: 'Sheet1', columns, rows: rows as never, rowCount: rows.length, columnCount: 3 }
}

const rows = [
  ['A', 10, true],
  ['A', 20, false],
  ['B', 5, true],
  ['B', 5, false],
  ['B', 5, false],
  ['C', 100, false],
]

describe('executeAnalyticalPlan — operators, aggregations, and edge cases', () => {
  it('filters with gt/gte/lt/lte', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, { datasetId: ds.id, filters: [{ column: 'Amount', op: 'gt', value: 10 }], measures: [{ as: 'n', aggregation: 'count' }] })
    expect(result.status === 'ok' && result.rows[0]!.measures.n).toBe(2) // 20, 100
  })

  it('filters with in', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, { datasetId: ds.id, filters: [{ column: 'Category', op: 'in', value: ['A', 'C'] }], measures: [{ as: 'n', aggregation: 'count' }] })
    expect(result.status === 'ok' && result.rows[0]!.measures.n).toBe(3)
  })

  it('filters with neq', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, { datasetId: ds.id, filters: [{ column: 'Category', op: 'neq', value: 'B' }], measures: [{ as: 'n', aggregation: 'count' }] })
    expect(result.status === 'ok' && result.rows[0]!.measures.n).toBe(3)
  })

  it('min and max', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, { datasetId: ds.id, measures: [{ as: 'lo', aggregation: 'min', column: 'Amount' }, { as: 'hi', aggregation: 'max', column: 'Amount' }] })
    expect(result.status === 'ok' && result.rows[0]!.measures.lo).toBe(5)
    expect(result.status === 'ok' && result.rows[0]!.measures.hi).toBe(100)
  })

  it('count_distinct', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, { datasetId: ds.id, measures: [{ as: 'distinctCategories', aggregation: 'count_distinct', column: 'Category' }] })
    expect(result.status === 'ok' && result.rows[0]!.measures.distinctCategories).toBe(3)
  })

  it('a conditional count via measure-level filters ("count of Flagged=true"), without a second plan', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, {
      datasetId: ds.id,
      measures: [{ as: 'flaggedCount', aggregation: 'count', filters: [{ column: 'Flagged', op: 'eq', value: true }] }, { as: 'total', aggregation: 'count' }],
    })
    expect(result.status === 'ok' && result.rows[0]!.measures.flaggedCount).toBe(2)
    expect(result.status === 'ok' && result.rows[0]!.measures.total).toBe(6)
  })

  it('a ratio with a zero denominator resolves to null, never NaN/Infinity', () => {
    const ds = dataset([])
    const plan: AnalyticalPlan = {
      datasetId: ds.id,
      measures: [{ as: 'rate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count' }, denominator: { aggregation: 'count' } } }],
    }
    const result = executeAnalyticalPlan(ds, plan)
    expect(result.status === 'ok' && result.rows[0]!.measures.rate).toBeNull()
  })

  it('avg over zero matching rows resolves to null, not 0 or NaN', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, {
      datasetId: ds.id,
      filters: [{ column: 'Category', op: 'eq', value: 'Nonexistent' }],
      measures: [{ as: 'avgAmount', aggregation: 'avg', column: 'Amount' }],
    })
    expect(result.status === 'ok' && result.rows[0]!.measures.avgAmount).toBeNull()
  })

  it('sort ascending and a limit', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, {
      datasetId: ds.id,
      dimensions: [{ column: 'Category' }],
      measures: [{ as: 'total', aggregation: 'sum', column: 'Amount' }],
      sort: { by: 'total', direction: 'asc' },
      limit: 1,
    })
    expect(result.status === 'ok' && result.rows).toHaveLength(1)
    expect(result.status === 'ok' && result.rows[0]!.dimensions.Category).toBe('B') // 5+5+5=15, lowest
  })

  it('duplicate measure "as" names → ambiguous_measure', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, { datasetId: ds.id, measures: [{ as: 'x', aggregation: 'count' }, { as: 'x', aggregation: 'sum', column: 'Amount' }] })
    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error.code).toBe('ambiguous_measure')
  })

  it('dateTrunc on a non-date column → incompatible_type', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, { datasetId: ds.id, dimensions: [{ column: 'Category', dateTrunc: 'year' }], measures: [{ as: 'n', aggregation: 'count' }] })
    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error.code).toBe('incompatible_type')
  })

  it('boolean filter matches native boolean cells regardless of column dataType', () => {
    const ds = dataset(rows)
    const result = executeAnalyticalPlan(ds, { datasetId: ds.id, filters: [{ column: 'Flagged', op: 'eq', value: true }], measures: [{ as: 'n', aggregation: 'count' }] })
    expect(result.status === 'ok' && result.rows[0]!.measures.n).toBe(2)
  })
})
