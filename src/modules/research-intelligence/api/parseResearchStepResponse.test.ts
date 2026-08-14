import { describe, expect, it } from 'vitest'
import { parseResearchStepResponse } from '@/modules/research-intelligence/api/parseResearchStepResponse'

describe('parseResearchStepResponse', () => {
  it('parses a search action', () => {
    const result = parseResearchStepResponse(JSON.stringify({ action: 'search', purpose: 'baseline', query: 'return rate policy' }))
    expect(result).toEqual({ status: 'search', purpose: 'baseline', query: 'return rate policy' })
  })

  it('parses an analyze_dataset action', () => {
    const result = parseResearchStepResponse(JSON.stringify({ action: 'analyze_dataset', purpose: 'quantify', subQuestion: 'What is the return rate by region?' }))
    expect(result).toEqual({ status: 'analyze_dataset', purpose: 'quantify', subQuestion: 'What is the return rate by region?' })
  })

  it('parses a stop', () => {
    const result = parseResearchStepResponse(JSON.stringify({ stop: true, reason: 'enough evidence' }))
    expect(result).toEqual({ status: 'stop', reason: 'enough evidence' })
  })

  it('parses a decline', () => {
    const result = parseResearchStepResponse(JSON.stringify({ error: 'no library content on this topic' }))
    expect(result).toEqual({ status: 'declined', reason: 'no library content on this topic' })
  })

  it('rejects a search with no query', () => {
    const result = parseResearchStepResponse(JSON.stringify({ action: 'search', purpose: 'baseline' }))
    expect(result.status).toBe('invalid')
  })

  it('rejects a dataset action with no subQuestion', () => {
    const result = parseResearchStepResponse(JSON.stringify({ action: 'analyze_dataset', purpose: 'quantify' }))
    expect(result.status).toBe('invalid')
  })

  it('rejects malformed JSON', () => {
    expect(parseResearchStepResponse('not json').status).toBe('invalid')
  })

  it('rejects an unrecognized action', () => {
    expect(parseResearchStepResponse(JSON.stringify({ action: 'browse_web', query: 'x' })).status).toBe('invalid')
  })

  it('strips markdown code fences', () => {
    const result = parseResearchStepResponse('```json\n{"action":"search","purpose":"p","query":"q"}\n```')
    expect(result.status).toBe('search')
  })
})
