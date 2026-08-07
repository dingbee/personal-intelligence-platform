import { describe, expect, it } from 'vitest'
import { buildImageChatSeedQuery } from '@/modules/assets/intelligence/buildImageChatSeedQuery'
import type { AssetAnalysis } from '@/shared/types/database'

function makeAnalysis(overrides: Partial<AssetAnalysis> = {}): AssetAnalysis {
  return {
    description: 'A handwritten page of notes on lined paper.',
    extractedText: null,
    detectedLanguage: null,
    confidence: null,
    documentIntelligence: null,
    analyzedAt: '2026-01-01T00:00:00.000Z',
    provider: 'openai',
    ...overrides,
  }
}

describe('buildImageChatSeedQuery', () => {
  it('is honest about not having analyzed the image yet, rather than pretending it has content', () => {
    const query = buildImageChatSeedQuery('1000552373', null)
    expect(query).toContain('1000552373')
    expect(query).toContain("hasn't analyzed it yet")
  })

  it('carries the real description when analysis exists, not just the title', () => {
    const query = buildImageChatSeedQuery('IMG_0231', makeAnalysis())
    expect(query).toContain('A handwritten page of notes on lined paper.')
  })

  it('includes extracted visible text when present', () => {
    const query = buildImageChatSeedQuery('IMG_0231', makeAnalysis({ extractedText: 'Meeting with John Friday.' }))
    expect(query).toContain('Visible text: Meeting with John Friday.')
  })

  it('omits the visible-text sentence when nothing was extracted', () => {
    const query = buildImageChatSeedQuery('IMG_0231', makeAnalysis())
    expect(query).not.toContain('Visible text')
  })
})
