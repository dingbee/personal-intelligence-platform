import { describe, expect, it } from 'vitest'
import { computeReadingInsights } from '@/modules/reader/intelligence/readingInsights'

const CHAPTERS = [
  { index: 0, title: 'Short Intro', content: 'a'.repeat(50) },
  { index: 1, title: 'Long Middle', content: 'b'.repeat(500) },
  { index: 2, title: 'Untouched End', content: 'c'.repeat(100) },
]

describe('computeReadingInsights', () => {
  it('returns nothing for no chapters', () => {
    expect(computeReadingInsights({ chapters: [], highlights: [], summaries: [] })).toEqual([])
  })

  it('identifies the longest chapter by content length', () => {
    const insights = computeReadingInsights({ chapters: CHAPTERS, highlights: [], summaries: [] })
    expect(insights).toContainEqual({ type: 'longest_chapter', label: 'Longest chapter', value: 'Long Middle' })
  })

  it('identifies the most highlighted chapter', () => {
    const insights = computeReadingInsights({
      chapters: CHAPTERS,
      highlights: [
        { chapter_index: 0, note: null },
        { chapter_index: 0, note: null },
        { chapter_index: 1, note: null },
      ],
      summaries: [],
    })
    expect(insights).toContainEqual({ type: 'most_highlighted_chapter', label: 'Most highlighted chapter', value: 'Short Intro' })
  })

  it('identifies a chapter with no highlights and no summary as least engaged', () => {
    const insights = computeReadingInsights({
      chapters: CHAPTERS,
      highlights: [{ chapter_index: 0, note: 'noted' }],
      summaries: [{ chapter_index: 1, updated_at: '2026-01-01T00:00:00.000Z' }],
    })
    expect(insights).toContainEqual({ type: 'least_read_section', label: 'Least engaged section', value: 'Untouched End' })
  })

  it('identifies the most recently summarized chapter', () => {
    const insights = computeReadingInsights({
      chapters: CHAPTERS,
      highlights: [],
      summaries: [
        { chapter_index: 0, updated_at: '2026-01-01T00:00:00.000Z' },
        { chapter_index: 1, updated_at: '2026-06-01T00:00:00.000Z' },
      ],
    })
    expect(insights).toContainEqual({ type: 'recently_summarized', label: 'Recently summarized', value: 'Long Middle' })
  })

  it('counts unreviewed highlights (no note)', () => {
    const insights = computeReadingInsights({
      chapters: CHAPTERS,
      highlights: [
        { chapter_index: 0, note: null },
        { chapter_index: 0, note: 'has a note' },
      ],
      summaries: [],
    })
    expect(insights).toContainEqual({
      type: 'unreviewed_highlights',
      label: 'Unreviewed highlights',
      value: '1 highlight with no note yet',
    })
  })

  it('omits unreviewed_highlights when every highlight has a note', () => {
    const insights = computeReadingInsights({
      chapters: CHAPTERS,
      highlights: [{ chapter_index: 0, note: 'noted' }],
      summaries: [],
    })
    expect(insights.some((i) => i.type === 'unreviewed_highlights')).toBe(false)
  })
})
