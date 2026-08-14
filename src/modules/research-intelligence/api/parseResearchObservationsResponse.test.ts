import { describe, expect, it } from 'vitest'
import { parseResearchObservationsResponse } from '@/modules/research-intelligence/api/parseResearchObservationsResponse'
import type { ResearchEvidence } from '@/modules/research-intelligence/researchInvestigation'

const evidence: ResearchEvidence[] = [
  { id: 'ev-1', source: { type: 'document', id: 'doc-1', title: 'Policy Doc' }, excerpt: 'Returns within 30 days are accepted.', similarity: 0.9 },
  { id: 'ev-2', source: { type: 'note', id: 'note-1', title: 'Meeting notes' }, excerpt: 'South region flagged for high returns.', similarity: 0.8 },
]

describe('parseResearchObservationsResponse', () => {
  it('resolves valid evidenceIndexes to real evidence ids', () => {
    const observations = parseResearchObservationsResponse(
      JSON.stringify({ observations: [{ statement: 'The 30-day policy applies broadly.', evidenceIndexes: [1] }] }),
      'step-1',
      evidence,
    )
    expect(observations).toHaveLength(1)
    expect(observations[0]!.evidenceIds).toEqual(['ev-1'])
    expect(observations[0]!.stepId).toBe('step-1')
  })

  it('supports an observation citing multiple evidence items', () => {
    const observations = parseResearchObservationsResponse(
      JSON.stringify({ observations: [{ statement: 'combined', evidenceIndexes: [1, 2] }] }),
      'step-1',
      evidence,
    )
    expect(observations[0]!.evidenceIds.sort()).toEqual(['ev-1', 'ev-2'])
  })

  it('drops an observation citing an out-of-range index (never fabricates a citation)', () => {
    const observations = parseResearchObservationsResponse(
      JSON.stringify({ observations: [{ statement: 'hallucinated', evidenceIndexes: [99] }] }),
      'step-1',
      evidence,
    )
    expect(observations).toEqual([])
  })

  it('drops an observation with no evidenceIndexes array', () => {
    const observations = parseResearchObservationsResponse(JSON.stringify({ observations: [{ statement: 'x' }] }), 'step-1', evidence)
    expect(observations).toEqual([])
  })

  it('returns an empty array when the model reports no relevant evidence', () => {
    expect(parseResearchObservationsResponse(JSON.stringify({ observations: [] }), 'step-1', evidence)).toEqual([])
  })

  it('degrades to an empty array on malformed JSON, never throwing', () => {
    expect(parseResearchObservationsResponse('not json', 'step-1', evidence)).toEqual([])
  })

  it('degrades to an empty array when there is no evidence to cite against', () => {
    const observations = parseResearchObservationsResponse(JSON.stringify({ observations: [{ statement: 'x', evidenceIndexes: [1] }] }), 'step-1', [])
    expect(observations).toEqual([])
  })

  it('Multimodal Evidence Integration: resolves a valid citation of image evidence exactly like document/note evidence — the parser is source-agnostic', () => {
    const mixedEvidence: ResearchEvidence[] = [...evidence, { id: 'ev-asset-1', source: { type: 'asset', id: 'asset-1', title: 'Dashboard screenshot' }, excerpt: 'Q3 revenue trending upward.', similarity: 0.85 }]
    const observations = parseResearchObservationsResponse(
      JSON.stringify({ observations: [{ statement: 'The dashboard shows Q3 revenue trending upward.', evidenceIndexes: [3] }] }),
      'step-1',
      mixedEvidence,
    )
    expect(observations).toHaveLength(1)
    expect(observations[0]!.evidenceIds).toEqual(['ev-asset-1'])
  })

  it('Multimodal Evidence Integration: an observation citing only an out-of-range index alongside real image evidence is still dropped — never keeps a partially-hallucinated citation', () => {
    const mixedEvidence: ResearchEvidence[] = [{ id: 'ev-asset-1', source: { type: 'asset', id: 'asset-1', title: 'Dashboard screenshot' }, excerpt: 'Q3 revenue trending upward.', similarity: 0.85 }]
    const observations = parseResearchObservationsResponse(JSON.stringify({ observations: [{ statement: 'invented claim about the image', evidenceIndexes: [99] }] }), 'step-1', mixedEvidence)
    expect(observations).toEqual([])
  })
})
