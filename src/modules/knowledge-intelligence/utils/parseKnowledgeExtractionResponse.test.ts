import { describe, expect, it } from 'vitest'
import {
  parseConceptsResponse,
  parseEntitiesResponse,
  parseRelationshipsResponse,
} from '@/modules/knowledge-intelligence/utils/parseKnowledgeExtractionResponse'

describe('parseConceptsResponse', () => {
  it('parses a plain JSON array', () => {
    const text = '[{"title": "Entropy", "description": "A measure of disorder."}]'
    expect(parseConceptsResponse(text)).toEqual([{ title: 'Entropy', description: 'A measure of disorder.' }])
  })

  it('strips markdown code fences', () => {
    const text = '```json\n[{"title": "Entropy"}]\n```'
    expect(parseConceptsResponse(text)).toEqual([{ title: 'Entropy', description: null }])
  })

  it('drops malformed items but keeps valid ones', () => {
    const text = '[{"title": "Entropy"}, {"description": "no title"}, "not an object"]'
    expect(parseConceptsResponse(text)).toEqual([{ title: 'Entropy', description: null }])
  })

  it('throws when no JSON array is present', () => {
    expect(() => parseConceptsResponse('Sorry, I cannot do that.')).toThrow()
  })
})

describe('parseEntitiesResponse', () => {
  it('carries entityType through', () => {
    const text = '[{"title": "Marie Curie", "description": "Physicist.", "entityType": "person"}]'
    expect(parseEntitiesResponse(text)).toEqual([
      { title: 'Marie Curie', description: 'Physicist.', entityType: 'person' },
    ])
  })
})

describe('parseRelationshipsResponse', () => {
  it('parses relationships with confidence', () => {
    const text = '[{"source": "A", "target": "B", "relationshipType": "relates_to", "confidence": 0.8}]'
    expect(parseRelationshipsResponse(text)).toEqual([
      { source: 'A', target: 'B', relationshipType: 'relates_to', confidence: 0.8 },
    ])
  })

  it('drops items missing required fields', () => {
    const text = '[{"source": "A", "relationshipType": "relates_to"}]'
    expect(parseRelationshipsResponse(text)).toEqual([])
  })
})
