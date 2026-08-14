import { describe, expect, it } from 'vitest'
import { parseResearchSynthesisResponse } from '@/modules/research-intelligence/api/parseResearchSynthesisResponse'
import type { ResearchSource } from '@/modules/research-intelligence/researchInvestigation'

const sources: ResearchSource[] = [
  { type: 'document', id: 'doc-1', title: 'Study A' },
  { type: 'note', id: 'note-1', title: 'Study B notes' },
]

function response(overrides: Record<string, unknown>) {
  return JSON.stringify({ synthesis: 'A synthesis paragraph.', keyFindings: ['finding 1'], limitations: 'some uncertainty', comparisons: [], gaps: [], followUpQuestions: [], ...overrides })
}

describe('parseResearchSynthesisResponse', () => {
  it('parses a well-formed response', () => {
    const result = parseResearchSynthesisResponse(response({}), sources)
    expect(result?.synthesis).toBe('A synthesis paragraph.')
    expect(result?.keyFindings).toEqual(['finding 1'])
    expect(result?.limitations).toBe('some uncertainty')
  })

  it('returns null (AI synthesis failure) on malformed JSON', () => {
    expect(parseResearchSynthesisResponse('not json', sources)).toBeNull()
  })

  it('returns null when "synthesis" is missing or empty', () => {
    expect(parseResearchSynthesisResponse(JSON.stringify({ keyFindings: [] }), sources)).toBeNull()
    expect(parseResearchSynthesisResponse(JSON.stringify({ synthesis: '   ' }), sources)).toBeNull()
  })

  it('resolves valid comparison sourceNumbers to real source ids', () => {
    const result = parseResearchSynthesisResponse(
      response({ comparisons: [{ sourceNumbers: [1, 2], relationship: 'agrees_with', description: 'both confirm the trend' }] }),
      sources,
    )
    expect(result?.comparisons).toHaveLength(1)
    expect(result?.comparisons[0]!.sourceIds.sort()).toEqual(['doc-1', 'note-1'])
    expect(result?.comparisons[0]!.relationship).toBe('agrees_with')
  })

  it('drops a comparison naming an out-of-range source number', () => {
    const result = parseResearchSynthesisResponse(response({ comparisons: [{ sourceNumbers: [1, 99], relationship: 'agrees_with', description: 'x' }] }), sources)
    expect(result?.comparisons).toEqual([])
  })

  it('drops a comparison with fewer than 2 resolved sources', () => {
    const result = parseResearchSynthesisResponse(response({ comparisons: [{ sourceNumbers: [1], relationship: 'agrees_with', description: 'x' }] }), sources)
    expect(result?.comparisons).toEqual([])
  })

  it('drops a comparison with an unrecognized relationship', () => {
    const result = parseResearchSynthesisResponse(response({ comparisons: [{ sourceNumbers: [1, 2], relationship: 'contradicts', description: 'x' }] }), sources)
    expect(result?.comparisons).toEqual([])
  })

  it('keeps only gaps with a valid reason from the closed set', () => {
    const result = parseResearchSynthesisResponse(
      response({ gaps: [{ description: 'missing data', reason: 'insufficient_evidence' }, { description: 'bad', reason: 'made_up_reason' }] }),
      sources,
    )
    expect(result?.gaps).toHaveLength(1)
    expect(result?.gaps[0]!.reason).toBe('insufficient_evidence')
  })

  it('caps followUpQuestions at 3', () => {
    const result = parseResearchSynthesisResponse(response({ followUpQuestions: ['a', 'b', 'c', 'd', 'e'] }), sources)
    expect(result?.followUpQuestions).toHaveLength(3)
  })
})
