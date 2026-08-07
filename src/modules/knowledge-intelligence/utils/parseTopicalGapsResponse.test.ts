import { describe, expect, it } from 'vitest'
import { parseTopicalGapsResponse } from '@/modules/knowledge-intelligence/utils/parseTopicalGapsResponse'

describe('parseTopicalGapsResponse', () => {
  it('parses a well-formed array', () => {
    const raw = '[{"label": "Financial Projections", "reason": "You have strategy and marketing, but no numbers."}]'
    const result = parseTopicalGapsResponse(raw)
    expect(result).toEqual([{ label: 'Financial Projections', reason: 'You have strategy and marketing, but no numbers.' }])
  })

  it('tolerates markdown code fences', () => {
    const raw = '```json\n[{"label": "Legal", "reason": "No contracts mentioned."}]\n```'
    expect(parseTopicalGapsResponse(raw)).toEqual([{ label: 'Legal', reason: 'No contracts mentioned.' }])
  })

  it('returns an empty array when the model finds nothing missing', () => {
    expect(parseTopicalGapsResponse('[]')).toEqual([])
  })

  it('drops items with no label', () => {
    const raw = '[{"reason": "no label here"}, {"label": "Budget", "reason": "ok"}]'
    expect(parseTopicalGapsResponse(raw)).toEqual([{ label: 'Budget', reason: 'ok' }])
  })

  it('defaults a missing reason to an empty string rather than throwing', () => {
    const raw = '[{"label": "Timeline"}]'
    expect(parseTopicalGapsResponse(raw)).toEqual([{ label: 'Timeline', reason: '' }])
  })

  it('throws when there is no JSON array in the response', () => {
    expect(() => parseTopicalGapsResponse('not json at all')).toThrow()
  })
})
