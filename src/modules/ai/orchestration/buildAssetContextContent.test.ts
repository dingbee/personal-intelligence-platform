import { describe, expect, it } from 'vitest'
import { buildAssetContextContent } from '@/modules/ai/orchestration/buildAssetContextContent'
import type { AssetAnalysis, DocumentIntelligence } from '@/shared/types/database'

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

function makeDocumentIntelligence(overrides: Partial<DocumentIntelligence> = {}): DocumentIntelligence {
  return { documentType: 'meeting notes', dates: [], decisions: [], tasks: [], analyzedAt: '2026-01-01T00:00:00.000Z', provider: 'openai', ...overrides }
}

describe('buildAssetContextContent', () => {
  it('always includes the title and description', () => {
    const content = buildAssetContextContent('IMG_0231', makeAnalysis())
    expect(content).toContain('Image: "IMG_0231"')
    expect(content).toContain('A handwritten page of notes on lined paper.')
  })

  it('includes extracted text with detected language when present', () => {
    const content = buildAssetContextContent('notes', makeAnalysis({ extractedText: 'Meeting Friday.', detectedLanguage: 'English' }))
    expect(content).toContain('Visible text (English): Meeting Friday.')
  })

  it('omits the language parenthetical when not detected', () => {
    const content = buildAssetContextContent('notes', makeAnalysis({ extractedText: 'Meeting Friday.', detectedLanguage: null }))
    expect(content).toContain('Visible text: Meeting Friday.')
  })

  it('never fabricates a visible-text section when none was extracted', () => {
    const content = buildAssetContextContent('notes', makeAnalysis())
    expect(content).not.toContain('Visible text')
  })

  it('includes dates, decisions, and tasks when documentIntelligence has them', () => {
    const content = buildAssetContextContent(
      'notes',
      makeAnalysis({
        documentIntelligence: makeDocumentIntelligence({
          dates: [{ label: 'Proposal due', date: 'Monday' }],
          decisions: ['Proceed with vendor A'],
          tasks: [{ description: 'Send proposal', owner: 'John' }],
        }),
      }),
    )
    expect(content).toContain('Dates mentioned: Proposal due — Monday')
    expect(content).toContain('Decisions recorded: Proceed with vendor A')
    expect(content).toContain('Tasks recorded: Send proposal (John)')
  })

  it('omits documentIntelligence sections with empty arrays', () => {
    const content = buildAssetContextContent('notes', makeAnalysis({ documentIntelligence: makeDocumentIntelligence() }))
    expect(content).not.toContain('Dates mentioned')
    expect(content).not.toContain('Decisions recorded')
    expect(content).not.toContain('Tasks recorded')
  })

  it('surfaces a low-confidence caveat rather than silently presenting an uncertain read as fact', () => {
    const content = buildAssetContextContent('notes', makeAnalysis({ confidence: { text: 0.3, entities: 0.9, relationships: 0.9 } }))
    expect(content).toContain('the transcribed text')
    expect(content).not.toContain('the identified entities')
  })

  it('adds no confidence caveat when every dimension is confident', () => {
    const content = buildAssetContextContent('notes', makeAnalysis({ confidence: { text: 0.9, entities: 0.9, relationships: 0.9 } }))
    expect(content).not.toContain('Note: the model was not fully confident')
  })

  it('adds no confidence caveat when confidence is null (no self-estimate reported)', () => {
    const content = buildAssetContextContent('notes', makeAnalysis({ confidence: null }))
    expect(content).not.toContain('Note: the model was not fully confident')
  })
})
