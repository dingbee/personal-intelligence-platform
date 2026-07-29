import { describe, expect, it } from 'vitest'
import { detectReadingSignals } from '@/modules/reader/intelligence/readingSignals'

const BASE = {
  chapterIndex: 1,
  totalChapters: 10,
  scrollFraction: 0.3,
  currentChapterHighlightCount: 0,
  currentChapterHasSummary: false,
  unreviewedHighlightCount: 0,
  progressUpdatedAt: null,
  now: new Date('2026-06-01T00:00:00.000Z'),
}

describe('detectReadingSignals', () => {
  it('returns nothing when nothing applies', () => {
    expect(detectReadingSignals(BASE)).toEqual([])
  })

  it('detects chapter_completed at the finished threshold', () => {
    const signals = detectReadingSignals({ ...BASE, scrollFraction: 0.96 })
    expect(signals.some((s) => s.type === 'chapter_completed')).toBe(true)
  })

  it('detects book_nearly_finished near the end of a long book', () => {
    const signals = detectReadingSignals({ ...BASE, chapterIndex: 8, totalChapters: 10 })
    expect(signals.some((s) => s.type === 'book_nearly_finished')).toBe(true)
  })

  it('does not detect book_nearly_finished mid-book', () => {
    const signals = detectReadingSignals({ ...BASE, chapterIndex: 3, totalChapters: 10 })
    expect(signals.some((s) => s.type === 'book_nearly_finished')).toBe(false)
  })

  it('detects high_highlight_density at the threshold', () => {
    const signals = detectReadingSignals({ ...BASE, currentChapterHighlightCount: 5 })
    expect(signals.some((s) => s.type === 'high_highlight_density')).toBe(true)
  })

  it('detects needs_summary when highlighted but not summarized', () => {
    const signals = detectReadingSignals({ ...BASE, currentChapterHighlightCount: 3, currentChapterHasSummary: false })
    expect(signals.some((s) => s.type === 'needs_summary')).toBe(true)
  })

  it('does not detect needs_summary once a summary exists', () => {
    const signals = detectReadingSignals({ ...BASE, currentChapterHighlightCount: 3, currentChapterHasSummary: true })
    expect(signals.some((s) => s.type === 'needs_summary')).toBe(false)
  })

  it('detects review_recommended at the unreviewed threshold', () => {
    const signals = detectReadingSignals({ ...BASE, unreviewedHighlightCount: 3 })
    expect(signals.some((s) => s.type === 'review_recommended')).toBe(true)
  })

  it('detects reading_gap past the day threshold', () => {
    const signals = detectReadingSignals({ ...BASE, progressUpdatedAt: '2026-05-01T00:00:00.000Z' })
    expect(signals.some((s) => s.type === 'reading_gap')).toBe(true)
  })

  it('does not detect reading_gap within the threshold', () => {
    const signals = detectReadingSignals({ ...BASE, progressUpdatedAt: '2026-05-30T00:00:00.000Z' })
    expect(signals.some((s) => s.type === 'reading_gap')).toBe(false)
  })

  it('detects strong_concept_cluster when graph nodes are plentiful', () => {
    const signals = detectReadingSignals({ ...BASE, graphNodeCount: 4 })
    expect(signals.some((s) => s.type === 'strong_concept_cluster')).toBe(true)
  })

  it('detects knowledge_saturation only when both density and graph signal are present', () => {
    const both = detectReadingSignals({ ...BASE, currentChapterHighlightCount: 5, graphNodeCount: 1 })
    expect(both.some((s) => s.type === 'knowledge_saturation')).toBe(true)

    const densityOnly = detectReadingSignals({ ...BASE, currentChapterHighlightCount: 5, graphNodeCount: 0 })
    expect(densityOnly.some((s) => s.type === 'knowledge_saturation')).toBe(false)
  })
})
