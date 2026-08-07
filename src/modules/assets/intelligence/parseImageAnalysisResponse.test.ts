import { describe, expect, it } from 'vitest'
import { parseImageAnalysisResponse } from '@/modules/assets/intelligence/parseImageAnalysisResponse'

describe('parseImageAnalysisResponse', () => {
  it('splits the description from the TEXT: line', () => {
    const raw = 'A whiteboard with a project plan sketched in marker.\nTEXT: Website redesign\nHomepage\nSEO\nLaunch June'
    const result = parseImageAnalysisResponse(raw)
    expect(result.description).toBe('A whiteboard with a project plan sketched in marker.')
    expect(result.extractedText).toBe('Website redesign\nHomepage\nSEO\nLaunch June')
  })

  it('returns null extractedText when the model reports no visible text', () => {
    const raw = 'A photo of a river at sunset.\nTEXT: (none)'
    const result = parseImageAnalysisResponse(raw)
    expect(result.description).toBe('A photo of a river at sunset.')
    expect(result.extractedText).toBeNull()
  })

  it('is case-insensitive and tolerant of surrounding whitespace on the TEXT: marker', () => {
    const raw = 'A screenshot of a dashboard.\n  text:   Revenue: $12,400  '
    const result = parseImageAnalysisResponse(raw)
    expect(result.extractedText).toBe('Revenue: $12,400')
  })

  it('treats an empty TEXT: value the same as (none)', () => {
    const raw = 'An empty page.\nTEXT:'
    const result = parseImageAnalysisResponse(raw)
    expect(result.extractedText).toBeNull()
  })

  it('falls back to the whole response as the description when there is no TEXT: line at all', () => {
    const raw = 'Just a plain description with no text marker.'
    const result = parseImageAnalysisResponse(raw)
    expect(result.description).toBe(raw)
    expect(result.extractedText).toBeNull()
  })

  it('preserves multi-line visible text verbatim, including blank lines', () => {
    const raw = 'A sign with a schedule.\nTEXT: Monday\n\nTuesday'
    const result = parseImageAnalysisResponse(raw)
    expect(result.extractedText).toBe('Monday\n\nTuesday')
  })
})
