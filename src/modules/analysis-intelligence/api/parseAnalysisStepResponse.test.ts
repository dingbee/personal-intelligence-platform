import { describe, expect, it } from 'vitest'
import { parseAnalysisStepResponse } from '@/modules/analysis-intelligence/api/parseAnalysisStepResponse'

describe('parseAnalysisStepResponse', () => {
  it('parses a well-formed plan step, with purpose and optional hypothesis', () => {
    const raw = JSON.stringify({
      purpose: 'baseline',
      hypothesis: 'Product mix may explain the elevated rate',
      plan: { dimensions: [{ column: 'Region' }], measures: [{ as: 'rate', aggregation: 'ratio', ratio: { numerator: { aggregation: 'count' }, denominator: { aggregation: 'count' } } }] },
    })
    const result = parseAnalysisStepResponse(raw, 'dataset-1')
    expect(result.status).toBe('plan')
    expect(result.status === 'plan' && result.plan.datasetId).toBe('dataset-1')
    expect(result.status === 'plan' && result.purpose).toBe('baseline')
    expect(result.status === 'plan' && result.hypothesis).toContain('Product mix')
  })

  it('defaults hypothesis to null and purpose to a fallback string when omitted', () => {
    const raw = JSON.stringify({ plan: { measures: [{ as: 'x', aggregation: 'count' }] } })
    const result = parseAnalysisStepResponse(raw, 'dataset-1')
    expect(result.status === 'plan' && result.hypothesis).toBeNull()
    expect(result.status === 'plan' && result.purpose).toBe('analytical step')
  })

  it('parses a stop response', () => {
    const result = parseAnalysisStepResponse(JSON.stringify({ stop: true, reason: 'Pattern is well established.' }), 'dataset-1')
    expect(result.status).toBe('stop')
    expect(result.status === 'stop' && result.reason).toBe('Pattern is well established.')
  })

  it('parses a declined response', () => {
    const result = parseAnalysisStepResponse(JSON.stringify({ error: 'No column relates to customer sentiment.' }), 'dataset-1')
    expect(result.status).toBe('declined')
  })

  it('strips a markdown code fence before parsing', () => {
    const raw = '```json\n' + JSON.stringify({ stop: true, reason: 'done' }) + '\n```'
    expect(parseAnalysisStepResponse(raw, 'dataset-1').status).toBe('stop')
  })

  it('treats invalid JSON as invalid', () => {
    expect(parseAnalysisStepResponse('not json', 'dataset-1').status).toBe('invalid')
  })

  it('treats a plan with no measures array as invalid', () => {
    expect(parseAnalysisStepResponse(JSON.stringify({ plan: { dimensions: [] } }), 'dataset-1').status).toBe('invalid')
  })

  it('treats a response with none of plan/stop/error as invalid', () => {
    expect(parseAnalysisStepResponse(JSON.stringify({ foo: 'bar' }), 'dataset-1').status).toBe('invalid')
  })
})
