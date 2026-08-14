import { describe, expect, it } from 'vitest'
import { assetAnalysisToProvenance } from '@/shared/provenance/adapters/assetAdapter'
import type { AssetAnalysis } from '@/shared/types/database'

const asset = { id: 'asset-1', title: 'Whiteboard photo' }

function analysis(overrides: Partial<AssetAnalysis> = {}): AssetAnalysis {
  return {
    description: 'A whiteboard showing a Q3 sales chart trending upward.',
    extractedText: 'Q3 Sales: +18%',
    detectedLanguage: 'English',
    confidence: { text: 0.9, entities: 0.8, relationships: 0.7 },
    documentIntelligence: null,
    analyzedAt: '2024-06-01T00:00:00.000Z',
    provider: 'anthropic',
    ...overrides,
  }
}

describe('assetAnalysisToProvenance', () => {
  it('distinguishes the original asset (source) from the extracted interpretation (evidence) and the AI-derived conclusion (derivation)', () => {
    const { evidence, derivation } = assetAnalysisToProvenance(asset, analysis())
    expect(evidence.source).toEqual({ type: 'asset', id: 'asset-1', title: 'Whiteboard photo' })
    expect(evidence.excerpt).toBe('Q3 Sales: +18%') // verbatim transcription, not the description
    expect(derivation.kind).toBe('interpretation')
    expect(derivation.statement).toBe('A whiteboard showing a Q3 sales chart trending upward.')
    expect(derivation.evidenceIds).toEqual([evidence.id])
  })

  it('uses the description as evidence when there is no transcribed text', () => {
    const { evidence } = assetAnalysisToProvenance(asset, analysis({ extractedText: null }))
    expect(evidence.excerpt).toBe('A whiteboard showing a Q3 sales chart trending upward.')
  })

  it('never invents an image region — location is always "whole" since analyzeImage carries no coordinates', () => {
    const { evidence } = assetAnalysisToProvenance(asset, analysis())
    expect(evidence.location).toEqual({ kind: 'whole' })
  })

  it('surfaces a low self-reported confidence as an explicit caveat rather than silent certainty', () => {
    const { derivation } = assetAnalysisToProvenance(asset, analysis({ confidence: { text: 0.3, entities: 0.8, relationships: null } }))
    expect(derivation.statement).toContain('low self-reported confidence')
    expect(derivation.statement).toContain('transcribed text')
  })

  it('adds no caveat when confidence is high or unavailable', () => {
    const { derivation } = assetAnalysisToProvenance(asset, analysis({ confidence: null }))
    expect(derivation.statement).not.toContain('low self-reported confidence')
  })
})
