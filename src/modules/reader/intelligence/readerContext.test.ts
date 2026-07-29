import { describe, expect, it } from 'vitest'
import { buildReaderContext } from '@/modules/reader/intelligence/readerContext'

const CHAPTERS = [
  { index: 0, title: 'Introduction' },
  { index: 1, title: 'The Turning Point' },
  { index: 2, title: 'Conclusion' },
]

describe('buildReaderContext', () => {
  it('resolves the current, previous, and next chapter titles', () => {
    const context = buildReaderContext({
      documentId: 'doc-1',
      documentTitle: 'Deep Work',
      chapters: CHAPTERS,
      activeChapterIndex: 1,
      scrollFraction: 0.5,
    })
    expect(context.chapterTitle).toBe('The Turning Point')
    expect(context.previousChapterTitle).toBe('Introduction')
    expect(context.nextChapterTitle).toBe('Conclusion')
  })

  it('has no previous chapter at the first chapter', () => {
    const context = buildReaderContext({
      documentId: 'doc-1',
      documentTitle: 'Deep Work',
      chapters: CHAPTERS,
      activeChapterIndex: 0,
      scrollFraction: 0,
    })
    expect(context.previousChapterTitle).toBeNull()
  })

  it('has no next chapter at the last chapter', () => {
    const context = buildReaderContext({
      documentId: 'doc-1',
      documentTitle: 'Deep Work',
      chapters: CHAPTERS,
      activeChapterIndex: 2,
      scrollFraction: 0.9,
    })
    expect(context.nextChapterTitle).toBeNull()
  })

  it('falls back to a generic chapter title when the chapter is missing from the list', () => {
    const context = buildReaderContext({
      documentId: 'doc-1',
      documentTitle: 'Deep Work',
      chapters: [],
      activeChapterIndex: 4,
      scrollFraction: 0,
    })
    expect(context.chapterTitle).toBe('Chapter 5')
  })

  it('defaults activeHighlightQuote to null when omitted', () => {
    const context = buildReaderContext({
      documentId: 'doc-1',
      documentTitle: 'Deep Work',
      chapters: CHAPTERS,
      activeChapterIndex: 0,
      scrollFraction: 0,
    })
    expect(context.activeHighlightQuote).toBeNull()
  })

  it('carries through an active highlight quote when given', () => {
    const context = buildReaderContext({
      documentId: 'doc-1',
      documentTitle: 'Deep Work',
      chapters: CHAPTERS,
      activeChapterIndex: 0,
      scrollFraction: 0,
      activeHighlightQuote: 'A quoted passage.',
    })
    expect(context.activeHighlightQuote).toBe('A quoted passage.')
  })
})
