export type ReadingInsightType =
  | 'longest_chapter'
  | 'most_highlighted_chapter'
  | 'least_read_section'
  | 'recently_summarized'
  | 'unreviewed_highlights'

export interface ReadingInsight {
  type: ReadingInsightType
  label: string
  value: string
}

export interface ReadingInsightsInput {
  chapters: { index: number; title: string; content: string }[]
  /** All highlights for this document (not chapter-scoped) — reuses listHighlights(documentId) with no chapterIndex filter. */
  highlights: { chapter_index: number | null; note: string | null }[]
  /** All chapter_summaries for this document — reuses the new listChapterSummaries. */
  summaries: { chapter_index: number; updated_at: string }[]
}

/**
 * UX-9 Phase 5 — deterministic only, over data already fetched by
 * readerInteraction.ts via existing APIs. "Frequently revisited chapter"
 * is deliberately not implemented here — there's no existing per-chapter
 * visit-count tracking to derive it from (same class of gap as UX-8's
 * "opened N times" attention item).
 */
export function computeReadingInsights(input: ReadingInsightsInput): ReadingInsight[] {
  const insights: ReadingInsight[] = []
  if (input.chapters.length === 0) return insights

  const longest = input.chapters.reduce((a, b) => (b.content.length > a.content.length ? b : a))
  insights.push({ type: 'longest_chapter', label: 'Longest chapter', value: longest.title })

  const highlightCounts = new Map<number, number>()
  for (const highlight of input.highlights) {
    if (highlight.chapter_index === null) continue
    highlightCounts.set(highlight.chapter_index, (highlightCounts.get(highlight.chapter_index) ?? 0) + 1)
  }
  if (highlightCounts.size > 0) {
    const [mostHighlightedIndex] = [...highlightCounts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))
    const chapter = input.chapters.find((c) => c.index === mostHighlightedIndex)
    if (chapter) insights.push({ type: 'most_highlighted_chapter', label: 'Most highlighted chapter', value: chapter.title })
  }

  const untouched = input.chapters.find(
    (chapter) => !highlightCounts.has(chapter.index) && !input.summaries.some((s) => s.chapter_index === chapter.index),
  )
  if (untouched) insights.push({ type: 'least_read_section', label: 'Least engaged section', value: untouched.title })

  if (input.summaries.length > 0) {
    const mostRecent = [...input.summaries].sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))[0]!
    const chapter = input.chapters.find((c) => c.index === mostRecent.chapter_index)
    if (chapter) insights.push({ type: 'recently_summarized', label: 'Recently summarized', value: chapter.title })
  }

  const unreviewedCount = input.highlights.filter((highlight) => highlight.note === null).length
  if (unreviewedCount > 0) {
    insights.push({
      type: 'unreviewed_highlights',
      label: 'Unreviewed highlights',
      value: `${unreviewedCount} highlight${unreviewedCount === 1 ? '' : 's'} with no note yet`,
    })
  }

  return insights
}
