import { describe, expect, it } from 'vitest'
import { parseAnalyticalPlanResponse } from '@/modules/data-intelligence/api/parseAnalyticalPlanResponse'

describe('parseAnalyticalPlanResponse', () => {
  it('parses a well-formed plan and injects the datasetId', () => {
    const raw = JSON.stringify({ dimensions: [{ column: 'Region' }], measures: [{ as: 'total', aggregation: 'sum', column: 'Total Price' }] })
    const result = parseAnalyticalPlanResponse(raw, 'dataset-1')
    expect(result.status).toBe('ok')
    expect(result.status === 'ok' && result.plan.datasetId).toBe('dataset-1')
    expect(result.status === 'ok' && result.plan.dimensions).toEqual([{ column: 'Region' }])
  })

  it('strips a markdown code fence before parsing', () => {
    const raw = '```json\n' + JSON.stringify({ measures: [{ as: 'x', aggregation: 'count' }] }) + '\n```'
    const result = parseAnalyticalPlanResponse(raw, 'dataset-1')
    expect(result.status).toBe('ok')
  })

  it('treats an explicit {"error": ...} response as a decline, not a parse failure', () => {
    const result = parseAnalyticalPlanResponse(JSON.stringify({ error: 'No column matches "profit margin".' }), 'dataset-1')
    expect(result.status).toBe('declined')
    expect(result.status === 'declined' && result.reason).toBe('No column matches "profit margin".')
  })

  it('treats invalid JSON as invalid, not a crash', () => {
    const result = parseAnalyticalPlanResponse('not json at all', 'dataset-1')
    expect(result.status).toBe('invalid')
  })

  it('treats a JSON value with no measures array as invalid', () => {
    const result = parseAnalyticalPlanResponse(JSON.stringify({ dimensions: [] }), 'dataset-1')
    expect(result.status).toBe('invalid')
  })

  it('treats a JSON array (not object) as invalid', () => {
    const result = parseAnalyticalPlanResponse('[1, 2, 3]', 'dataset-1')
    expect(result.status).toBe('invalid')
  })
})
