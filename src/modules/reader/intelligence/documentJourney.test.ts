import { describe, expect, it } from 'vitest'
import { computeDocumentJourney } from '@/modules/reader/intelligence/documentJourney'

const BASE = {
  hasProgress: false,
  chapterIndex: 0,
  totalChapters: 5,
  scrollFraction: 0,
  progressUpdatedAt: null,
  summarizedChapterCount: 0,
  flashcardCount: 0,
  notesAddedCount: 0,
  conversationCount: 0,
  now: new Date('2026-06-01T00:00:00.000Z'),
}

describe('computeDocumentJourney', () => {
  it('is not_started with no progress row', () => {
    expect(computeDocumentJourney(BASE).status).toBe('not_started')
  })

  it('is started with recent progress, not on the last chapter', () => {
    const journey = computeDocumentJourney({
      ...BASE,
      hasProgress: true,
      chapterIndex: 1,
      progressUpdatedAt: '2026-05-30T00:00:00.000Z',
    })
    expect(journey.status).toBe('started')
  })

  it('is paused when progress is stale', () => {
    const journey = computeDocumentJourney({
      ...BASE,
      hasProgress: true,
      chapterIndex: 1,
      progressUpdatedAt: '2026-05-01T00:00:00.000Z',
    })
    expect(journey.status).toBe('paused')
  })

  it('is completed on the last chapter past the finished threshold', () => {
    const journey = computeDocumentJourney({
      ...BASE,
      hasProgress: true,
      chapterIndex: 4,
      totalChapters: 5,
      scrollFraction: 0.99,
      progressUpdatedAt: '2026-05-30T00:00:00.000Z',
    })
    expect(journey.status).toBe('completed')
  })

  it('is not completed on the last chapter if not scrolled through', () => {
    const journey = computeDocumentJourney({
      ...BASE,
      hasProgress: true,
      chapterIndex: 4,
      totalChapters: 5,
      scrollFraction: 0.3,
      progressUpdatedAt: '2026-05-30T00:00:00.000Z',
    })
    expect(journey.status).toBe('started')
  })

  it('passes through the engagement counts unchanged', () => {
    const journey = computeDocumentJourney({
      ...BASE,
      summarizedChapterCount: 2,
      flashcardCount: 10,
      notesAddedCount: 3,
      conversationCount: 4,
    })
    expect(journey).toMatchObject({
      summarizedChapterCount: 2,
      flashcardCount: 10,
      notesAddedCount: 3,
      questionsAskedCount: 4,
    })
  })
})
