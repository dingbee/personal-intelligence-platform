import { describe, expect, it } from 'vitest'
import { formatAnalyticalResultForInterpretation } from '@/modules/data-intelligence/api/formatAnalyticalResultForInterpretation'
import type { AnalyticalPlan } from '@/modules/data-intelligence/analyticalPlan'

const plan: AnalyticalPlan = { datasetId: 'ds-1', measures: [{ as: 'total', aggregation: 'sum', column: 'Total Price' }] }

describe('formatAnalyticalResultForInterpretation', () => {
  it('formats a validation error explicitly, instructing not to guess', () => {
    const text = formatAnalyticalResultForInterpretation({ status: 'error', plan, error: { code: 'unknown_column', message: 'Column "Foo" does not exist.' } })
    expect(text).toContain('VALIDATION ERROR')
    expect(text).toContain('Column "Foo" does not exist.')
    expect(text).toContain('Do not guess')
  })

  it('formats a zero-row result as an explicit "no matching data" statement', () => {
    const text = formatAnalyticalResultForInterpretation({
      status: 'ok',
      plan,
      rows: [],
      provenance: { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 30, rowsMatchedAfterFilters: 0 },
    })
    expect(text).toContain('No rows matched')
    expect(text).toContain('do not invent')
  })

  it('formats computed rows with dimension/measure pairs and provenance counts', () => {
    const text = formatAnalyticalResultForInterpretation({
      status: 'ok',
      plan,
      rows: [{ dimensions: { Salesperson: 'Alice' }, measures: { total: 3225.5 } }],
      provenance: { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 30, rowsMatchedAfterFilters: 30 },
    })
    expect(text).toContain('Salesperson=Alice')
    expect(text).toContain('total=3225.5')
    expect(text).toContain('30 of 30')
  })

  it('flags a null measure (e.g. a zero-denominator ratio) as not computable, never silently 0', () => {
    const text = formatAnalyticalResultForInterpretation({
      status: 'ok',
      plan,
      rows: [{ dimensions: {}, measures: { rate: null } }],
      provenance: { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 0, rowsMatchedAfterFilters: 0 },
    })
    expect(text).toContain('not computable')
  })
})
