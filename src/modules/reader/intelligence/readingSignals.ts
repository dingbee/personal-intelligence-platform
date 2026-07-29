import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

const FINISHED_THRESHOLD = 0.95
const NEARLY_FINISHED_CHAPTERS_REMAINING = 2
const HIGH_HIGHLIGHT_DENSITY_THRESHOLD = 5
const NEEDS_SUMMARY_MIN_HIGHLIGHTS = 2
const REVIEW_RECOMMENDED_MIN_UNREVIEWED = 3
const READING_GAP_DAYS = 7
const STRONG_CONCEPT_CLUSTER_MIN_NODES = 3

export interface ReadingSignalsInput {
  chapterIndex: number
  totalChapters: number
  scrollFraction: number
  currentChapterHighlightCount: number
  currentChapterHasSummary: boolean
  unreviewedHighlightCount: number
  progressUpdatedAt: string | null
  /** Only known while chatting from Reader — omitted when there's no active AI turn to derive it from. */
  graphNodeCount?: number
  now?: Date
}

/**
 * UX-9 Phase 6 — extends the existing signal system (informational only,
 * never auto-acted-on) with Reader-specific detections. Deterministic
 * thresholds over data readerInteraction.ts already fetched via existing
 * APIs; no AI, no new query.
 */
export function detectReadingSignals(input: ReadingSignalsInput): IntelligenceSignal[] {
  const signals: IntelligenceSignal[] = []
  const now = input.now ?? new Date()

  if (input.scrollFraction >= FINISHED_THRESHOLD) {
    signals.push({ type: 'chapter_completed', message: 'This chapter is finished.' })
  }

  if (input.totalChapters > NEARLY_FINISHED_CHAPTERS_REMAINING + 1 && input.chapterIndex >= input.totalChapters - NEARLY_FINISHED_CHAPTERS_REMAINING) {
    signals.push({ type: 'book_nearly_finished', message: 'Only a couple of chapters remain in this book.' })
  }

  const highDensity = input.currentChapterHighlightCount >= HIGH_HIGHLIGHT_DENSITY_THRESHOLD
  if (highDensity) {
    signals.push({ type: 'high_highlight_density', message: 'This chapter has an unusually high number of highlights.' })
  }

  if (!input.currentChapterHasSummary && input.currentChapterHighlightCount >= NEEDS_SUMMARY_MIN_HIGHLIGHTS) {
    signals.push({ type: 'needs_summary', message: "You've highlighted this chapter but haven't summarized it yet." })
  }

  if (input.unreviewedHighlightCount >= REVIEW_RECOMMENDED_MIN_UNREVIEWED) {
    signals.push({ type: 'review_recommended', message: `${input.unreviewedHighlightCount} highlights haven't been reviewed yet.` })
  }

  if (input.progressUpdatedAt) {
    const daysSince = Math.floor((now.getTime() - new Date(input.progressUpdatedAt).getTime()) / (24 * 60 * 60 * 1000))
    if (daysSince >= READING_GAP_DAYS) {
      signals.push({ type: 'reading_gap', message: `It's been ${daysSince} days since you last read this.` })
    }
  }

  const graphNodeCount = input.graphNodeCount ?? 0
  if (graphNodeCount >= STRONG_CONCEPT_CLUSTER_MIN_NODES) {
    signals.push({ type: 'strong_concept_cluster', message: 'This chapter connects to several concepts in your knowledge graph.' })
  }

  if (highDensity && graphNodeCount > 0) {
    signals.push({ type: 'knowledge_saturation', message: "You've extracted a lot of structured knowledge from this chapter." })
  }

  return signals
}
