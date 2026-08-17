import { describe, expect, it, vi } from 'vitest'

const { listHighlightsMock, listFlashcardsMock, listChapterSummariesMock, listNotesMock, listConversationsMock } = vi.hoisted(() => ({
  listHighlightsMock: vi.fn(async () => [] as { chapter_index: number | null; note: string | null }[]),
  listFlashcardsMock: vi.fn(async () => [] as { chapter_index: number | null }[]),
  listChapterSummariesMock: vi.fn(async () => [] as { chapter_index: number; updated_at: string }[]),
  listNotesMock: vi.fn(async () => [] as { id: string }[]),
  listConversationsMock: vi.fn(async () => [] as { id: string }[]),
}))

vi.mock('@/modules/reader/api/highlights', () => ({ listHighlights: listHighlightsMock }))
vi.mock('@/modules/reader/api/flashcards', () => ({ listFlashcards: listFlashcardsMock }))
vi.mock('@/modules/reader/api/chapterSummaries', () => ({ listChapterSummaries: listChapterSummariesMock }))
vi.mock('@/modules/notes/api/notes', () => ({ listNotes: listNotesMock }))
vi.mock('@/modules/ai/chat/api/conversations', () => ({ listConversations: listConversationsMock }))

import { buildReaderInteractionState } from '@/modules/reader/intelligence/readerInteraction'

const CHAPTERS = [
  { index: 0, title: 'Introduction', content: 'a'.repeat(50), chunkIds: ['c1'] },
  { index: 1, title: 'Middle', content: 'b'.repeat(500), chunkIds: ['c2'] },
]

function baseParams() {
  return {
    documentId: 'doc-1',
    documentTitle: 'Deep Work',
    chapters: CHAPTERS,
    activeChapterIndex: 0,
    scrollFraction: 0.3,
    progressUpdatedAt: '2026-06-01T00:00:00.000Z' as string | null,
  }
}

describe('buildReaderInteractionState', () => {
  it('returns a fully-shaped ReaderInteractionState', async () => {
    const state = await buildReaderInteractionState(baseParams())
    expect(state.document).toEqual({ id: 'doc-1', title: 'Deep Work' })
    expect(state.chapter).toEqual({ index: 0, title: 'Introduction' })
    expect(state.progress).toEqual({ scrollFraction: 0.3 })
    expect(state).toHaveProperty('insights')
    expect(state).toHaveProperty('signals')
    expect(state).toHaveProperty('suggestions')
    expect(state).toHaveProperty('journey')
    expect(state.references).toEqual([])
  })

  it('passes through references from the last Reader Chat turn unchanged', async () => {
    const references = [{ type: 'document' as const, id: 'doc-1', title: 'Deep Work' }]
    const state = await buildReaderInteractionState({ ...baseParams(), references })
    expect(state.references).toEqual(references)
  })

  it('feeds fetched highlights/summaries into readingInsights and readingSignals', async () => {
    listHighlightsMock.mockResolvedValueOnce([
      { chapter_index: 0, note: null },
      { chapter_index: 0, note: null },
    ])
    const state = await buildReaderInteractionState(baseParams())
    expect(state.insights.some((i) => i.type === 'most_highlighted_chapter')).toBe(true)
    expect(state.suggestions.some((s) => s.kind === 'local' && s.id === 'highlights')).toBe(true)
  })

  it('degrades gracefully when every underlying fetch fails', async () => {
    listHighlightsMock.mockRejectedValueOnce(new Error('boom'))
    listFlashcardsMock.mockRejectedValueOnce(new Error('boom'))
    listChapterSummariesMock.mockRejectedValueOnce(new Error('boom'))
    listNotesMock.mockRejectedValueOnce(new Error('boom'))
    listConversationsMock.mockRejectedValueOnce(new Error('boom'))

    const state = await buildReaderInteractionState(baseParams())
    expect(state.journey.summarizedChapterCount).toBe(0)
    expect(state.journey.flashcardCount).toBe(0)
  })

  // Capability Audit #11+ — Learning Mode consumer-chain activation.
  // detectLearningIntelligence itself is untouched and already tested in
  // learningEngine.test.ts; these tests cover only the new wiring: does
  // buildReaderInteractionState pass it the real journey/highlight data
  // and a real intent, and does the result land on ReaderInteractionState.
  describe('learningMode', () => {
    it('is null when no intent is provided — no Reader Chat turn has happened yet', async () => {
      const state = await buildReaderInteractionState(baseParams())
      expect(state.learningMode).toBeNull()
    })

    it('is null for a non-learning intent even when a real journey and unreviewed highlights exist', async () => {
      listHighlightsMock.mockResolvedValueOnce([{ chapter_index: 0, note: null }])
      const state = await buildReaderInteractionState({
        ...baseParams(),
        progressUpdatedAt: new Date().toISOString(),
        intent: 'search',
      })
      expect(state.learningMode).toBeNull()
    })

    it('is non-null for a learning intent, deriving stage/suggestedNextStep from the real journey and opportunities from the real highlight/flashcard counts', async () => {
      listHighlightsMock.mockResolvedValueOnce([
        { chapter_index: 0, note: null }, // unreviewed
        { chapter_index: 0, note: 'already annotated' },
      ])
      listFlashcardsMock.mockResolvedValueOnce([{ chapter_index: 0 }, { chapter_index: 0 }]) // 2 < LOW_FLASHCARD_THRESHOLD (5)

      const state = await buildReaderInteractionState({
        ...baseParams(),
        progressUpdatedAt: new Date().toISOString(), // recent -> journey.status 'started' -> stage 'in_progress'
        intent: 'review', // a LEARNING_INTENTS member
      })

      expect(state.learningMode).not.toBeNull()
      expect(state.learningMode?.stage).toBe('in_progress')
      expect(state.learningMode?.suggestedNextStep).toBe('Continue reading where you left off.')
      // Reflects the actual unreviewed highlight above, not a guess.
      expect(state.learningMode?.reviewOpportunity).toBe(true)
      // Reflects the actual low flashcard count above (2 < 5) at an in_progress stage.
      expect(state.learningMode?.practiceOpportunity).toBe(true)
    })

    it('reports no opportunities when there is nothing to review or practice', async () => {
      listFlashcardsMock.mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ chapter_index: i % 2 }))) // >= LOW_FLASHCARD_THRESHOLD
      const state = await buildReaderInteractionState({
        ...baseParams(),
        progressUpdatedAt: new Date().toISOString(),
        intent: 'review',
      })
      expect(state.learningMode?.reviewOpportunity).toBe(false)
      expect(state.learningMode?.practiceOpportunity).toBe(false)
    })
  })
})
