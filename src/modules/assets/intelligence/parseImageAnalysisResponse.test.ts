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

  it('parses LANGUAGE: and CONFIDENCE: alongside TEXT:', () => {
    const raw =
      'A handwritten meeting note.\n' +
      'TEXT: Meeting with John Friday. Need proposal by Monday.\n' +
      'LANGUAGE: English\n' +
      'CONFIDENCE: text=0.9, entities=0.7, relationships=0.5'
    const result = parseImageAnalysisResponse(raw)
    expect(result.description).toBe('A handwritten meeting note.')
    expect(result.extractedText).toBe('Meeting with John Friday. Need proposal by Monday.')
    expect(result.detectedLanguage).toBe('English')
    expect(result.confidence).toEqual({ text: 0.9, entities: 0.7, relationships: 0.5 })
  })

  it('treats LANGUAGE: none the same as no visible text', () => {
    const raw = 'A photo of a landscape.\nTEXT: (none)\nLANGUAGE: none'
    const result = parseImageAnalysisResponse(raw)
    expect(result.detectedLanguage).toBeNull()
  })

  it('returns null confidence when the model omits the CONFIDENCE: line', () => {
    const raw = 'A diagram.\nTEXT: (none)\nLANGUAGE: none'
    const result = parseImageAnalysisResponse(raw)
    expect(result.confidence).toBeNull()
  })

  it('clamps an out-of-range confidence value into [0, 1] and ignores malformed/negative entries', () => {
    const raw = 'A chart.\nTEXT: (none)\nCONFIDENCE: text=1.5, entities=not-a-number, relationships=-0.2'
    const result = parseImageAnalysisResponse(raw)
    expect(result.confidence).toEqual({ text: 1, entities: null, relationships: null })
  })

  it('handles markers appearing in a different order than the prompt asks for', () => {
    const raw = 'A screenshot.\nLANGUAGE: English\nCONFIDENCE: text=0.8, entities=0.8, relationships=0.8\nTEXT: Revenue up 20%'
    const result = parseImageAnalysisResponse(raw)
    expect(result.extractedText).toBe('Revenue up 20%')
    expect(result.detectedLanguage).toBe('English')
    expect(result.confidence).toEqual({ text: 0.8, entities: 0.8, relationships: 0.8 })
  })
})
