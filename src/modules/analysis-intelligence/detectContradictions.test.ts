import { describe, expect, it } from 'vitest'
import { detectOppositeDirectionTensions } from '@/modules/analysis-intelligence/detectContradictions'
import type { AnalysisStep } from '@/modules/analysis-intelligence/analysisInvestigation'
import type { AnalyticalPlan, AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

const provenance = { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 30, rowsMatchedAfterFilters: 30 }

function trendStep(id: string, measureAs: string, values: number[]): AnalysisStep {
  const plan: AnalyticalPlan = { datasetId: 'ds-1', dimensions: [{ column: 'Order Date', dateTrunc: 'year' }], measures: [{ as: measureAs, aggregation: 'sum', column: 'Total Price' }] }
  const rows = values.map((v, i) => ({ dimensions: { 'Order Date': String(2023 + i) }, measures: { [measureAs]: v } }))
  const result: AnalyticalResult = { status: 'ok', plan, rows, provenance }
  return { id, index: 0, purpose: 'trend', triggeredBy: null, plan, result, observations: values.map((_, i) => ({ id: `${id}-obs-${i}`, stepId: id, statement: 'x', value: null, provenance })) }
}

describe('detectOppositeDirectionTensions', () => {
  it('flags two measures trending in opposite directions across the same period breakdown', () => {
    const steps = [trendStep('step-sales', 'totalSales', [1000, 1200, 1500]), trendStep('step-volume', 'unitVolume', [500, 480, 420])]
    const contradictions = detectOppositeDirectionTensions(steps)
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0]!.description).toContain('totalSales')
    expect(contradictions[0]!.description).toContain('unitVolume')
    expect(contradictions[0]!.observationIds).toHaveLength(2)
  })

  it('does not flag two measures trending in the same direction', () => {
    const steps = [trendStep('step-sales', 'totalSales', [1000, 1200, 1500]), trendStep('step-volume', 'unitVolume', [500, 520, 540])]
    expect(detectOppositeDirectionTensions(steps)).toEqual([])
  })

  it('does not flag a flat trend against a moving one', () => {
    const steps = [trendStep('step-sales', 'totalSales', [1000, 1000, 1000]), trendStep('step-volume', 'unitVolume', [500, 480, 420])]
    expect(detectOppositeDirectionTensions(steps)).toEqual([])
  })

  it('ignores steps with fewer than 2 usable data points', () => {
    const steps = [trendStep('step-sales', 'totalSales', [1000]), trendStep('step-volume', 'unitVolume', [500, 400])]
    expect(detectOppositeDirectionTensions(steps)).toEqual([])
  })

  it('ignores non-time-series steps (no dateTrunc dimension)', () => {
    const plan: AnalyticalPlan = { datasetId: 'ds-1', dimensions: [{ column: 'Region' }], measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }] }
    const result: AnalyticalResult = { status: 'ok', plan, rows: [{ dimensions: { Region: 'North' }, measures: { totalSales: 100 } }, { dimensions: { Region: 'South' }, measures: { totalSales: 50 } }], provenance }
    const step: AnalysisStep = { id: 'step-region', index: 0, purpose: 'by region', triggeredBy: null, plan, result, observations: [] }
    expect(detectOppositeDirectionTensions([step])).toEqual([])
  })

  it('ignores a failed step entirely', () => {
    const plan: AnalyticalPlan = { datasetId: 'ds-1', dimensions: [{ column: 'Order Date', dateTrunc: 'year' }], measures: [{ as: 'totalSales', aggregation: 'sum', column: 'Total Price' }] }
    const result: AnalyticalResult = { status: 'error', plan, error: { code: 'unknown_column', message: 'boom' } }
    const step: AnalysisStep = { id: 'step-failed', index: 0, purpose: 'x', triggeredBy: null, plan, result, observations: [] }
    expect(detectOppositeDirectionTensions([step, trendStep('step-volume', 'unitVolume', [500, 400])])).toEqual([])
  })
})
