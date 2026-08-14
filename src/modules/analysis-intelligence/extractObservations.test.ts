import { describe, expect, it } from 'vitest'
import { extractObservations } from '@/modules/analysis-intelligence/extractObservations'
import type { AnalyticalPlan, AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

const plan: AnalyticalPlan = { datasetId: 'ds-1', dimensions: [{ column: 'Region' }], measures: [{ as: 'returnRate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count' }, denominator: { aggregation: 'count' } } }] }
const provenance = { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 30, rowsMatchedAfterFilters: 30 }

describe('extractObservations', () => {
  it('extracts no observations from a failed step — never fabricates evidence', () => {
    const result: AnalyticalResult = { status: 'error', plan, error: { code: 'unknown_column', message: 'boom' } }
    expect(extractObservations({ id: 'step-1', result })).toEqual([])
  })

  it('extracts exactly one honest "no rows matched" observation for a valid but empty result', () => {
    const result: AnalyticalResult = { status: 'ok', plan, rows: [], provenance }
    const observations = extractObservations({ id: 'step-1', result })
    expect(observations).toHaveLength(1)
    expect(observations[0]!.statement).toContain('No rows matched')
    expect(observations[0]!.value).toBeNull()
  })

  it('populates a single traceable value when the plan has exactly one measure', () => {
    const result: AnalyticalResult = {
      status: 'ok',
      plan,
      rows: [
        { dimensions: { Region: 'South' }, measures: { returnRate: 0.261 } },
        { dimensions: { Region: 'North' }, measures: { returnRate: 0.267 } },
      ],
      provenance,
    }
    const observations = extractObservations({ id: 'step-1', result })
    expect(observations).toHaveLength(2)
    expect(observations[0]!.value).toBe(0.261)
    expect(observations[0]!.statement).toContain('South')
    expect(observations[0]!.stepId).toBe('step-1')
    expect(observations[0]!.provenance).toEqual(provenance)
  })

  it('leaves value null (but still describes it in the statement) when a row has multiple measures — never guesses which number the value should be', () => {
    const multiMeasurePlan: AnalyticalPlan = { ...plan, measures: [{ as: 'a', aggregation: 'count' }, { as: 'b', aggregation: 'sum', column: 'Total Price' }] }
    const result: AnalyticalResult = { status: 'ok', plan: multiMeasurePlan, rows: [{ dimensions: { Region: 'South' }, measures: { a: 10, b: 500 } }], provenance }
    const observations = extractObservations({ id: 'step-1', result })
    expect(observations[0]!.value).toBeNull()
    expect(observations[0]!.statement).toContain('a=10')
    expect(observations[0]!.statement).toContain('b=500')
  })

  it('caps observations at 10 rows even when the result has more', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ dimensions: { Region: `R${i}` }, measures: { returnRate: 0.1 } }))
    const result: AnalyticalResult = { status: 'ok', plan, rows, provenance }
    expect(extractObservations({ id: 'step-1', result })).toHaveLength(10)
  })
})
