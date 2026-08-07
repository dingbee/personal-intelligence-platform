import { describe, expect, it } from 'vitest'
import { parseDocumentIntelligenceResponse } from '@/modules/processing/documentIntelligence/parseDocumentIntelligenceResponse'

describe('parseDocumentIntelligenceResponse', () => {
  it('parses a complete, well-formed response', () => {
    const raw = JSON.stringify({
      documentType: 'meeting notes',
      dates: [{ label: 'Launch date', date: 'June 2026' }],
      decisions: ['Proceed with the booking engine vendor'],
      tasks: [{ description: 'Redesign the homepage', owner: 'Design team' }],
    })
    const result = parseDocumentIntelligenceResponse(raw)
    expect(result.documentType).toBe('meeting notes')
    expect(result.dates).toEqual([{ label: 'Launch date', date: 'June 2026' }])
    expect(result.decisions).toEqual(['Proceed with the booking engine vendor'])
    expect(result.tasks).toEqual([{ description: 'Redesign the homepage', owner: 'Design team' }])
  })

  it('tolerates markdown code fences around the JSON', () => {
    const raw = '```json\n{"documentType": "contract", "dates": [], "decisions": [], "tasks": []}\n```'
    const result = parseDocumentIntelligenceResponse(raw)
    expect(result.documentType).toBe('contract')
  })

  it('defaults documentType to "other" when missing or empty', () => {
    const result = parseDocumentIntelligenceResponse(JSON.stringify({ dates: [], decisions: [], tasks: [] }))
    expect(result.documentType).toBe('other')
  })

  it('defaults every array field to empty when missing, rather than throwing', () => {
    const result = parseDocumentIntelligenceResponse(JSON.stringify({ documentType: 'report' }))
    expect(result.dates).toEqual([])
    expect(result.decisions).toEqual([])
    expect(result.tasks).toEqual([])
  })

  it('normalizes a task with no stated owner to null, not a fabricated value', () => {
    const raw = JSON.stringify({ documentType: 'report', dates: [], decisions: [], tasks: [{ description: 'Follow up', owner: null }] })
    const result = parseDocumentIntelligenceResponse(raw)
    expect(result.tasks).toEqual([{ description: 'Follow up', owner: null }])
  })

  it('filters out malformed array entries rather than discarding the whole array', () => {
    const raw = JSON.stringify({
      documentType: 'report',
      dates: [{ label: 'Deadline', date: 'July' }, { label: 'missing date' }, 'not an object'],
      decisions: ['A real decision', 42, null],
      tasks: [{ description: 'Real task' }, { owner: 'no description' }],
    })
    const result = parseDocumentIntelligenceResponse(raw)
    expect(result.dates).toEqual([{ label: 'Deadline', date: 'July' }])
    expect(result.decisions).toEqual(['A real decision'])
    expect(result.tasks).toEqual([{ description: 'Real task', owner: null }])
  })

  it('throws when the response contains no JSON object at all', () => {
    expect(() => parseDocumentIntelligenceResponse('just plain text, no JSON here')).toThrow()
  })
})
