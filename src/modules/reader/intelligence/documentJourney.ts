export type DocumentJourneyStatus = 'not_started' | 'started' | 'paused' | 'completed'

/**
 * UX-9 Phase 4 — pure aggregation, recomputed fresh each time from
 * existing counts (reading_progress, chapter_summaries, flashcards,
 * notes, conversations). No event log, no schema: "started"/"paused"/
 * "resumed"/"completed" collapse into one current `status` rather than a
 * literal history of transitions, since nothing persists that history.
 * "Memories created" and "Concepts linked" from the brief's example list
 * are omitted — ai_memory has no document association in the schema, and
 * no existing hook exposes a per-document knowledge_node_sources count;
 * both would need a new query/column beyond what's justified here.
 */
export interface DocumentJourney {
  status: DocumentJourneyStatus
  summarizedChapterCount: number
  flashcardCount: number
  notesAddedCount: number
  questionsAskedCount: number
}

export interface DocumentJourneyInput {
  hasProgress: boolean
  chapterIndex: number
  totalChapters: number
  scrollFraction: number
  progressUpdatedAt: string | null
  summarizedChapterCount: number
  flashcardCount: number
  notesAddedCount: number
  conversationCount: number
  now?: Date
}

const FINISHED_THRESHOLD = 0.95
const PAUSED_AFTER_DAYS = 7

export function computeDocumentJourney(input: DocumentJourneyInput): DocumentJourney {
  const now = input.now ?? new Date()
  let status: DocumentJourneyStatus = 'not_started'

  if (input.hasProgress) {
    const isLastChapter = input.totalChapters > 0 && input.chapterIndex >= input.totalChapters - 1
    if (isLastChapter && input.scrollFraction >= FINISHED_THRESHOLD) {
      status = 'completed'
    } else if (input.progressUpdatedAt) {
      const daysSince = Math.floor((now.getTime() - new Date(input.progressUpdatedAt).getTime()) / (24 * 60 * 60 * 1000))
      status = daysSince >= PAUSED_AFTER_DAYS ? 'paused' : 'started'
    } else {
      status = 'started'
    }
  }

  return {
    status,
    summarizedChapterCount: input.summarizedChapterCount,
    flashcardCount: input.flashcardCount,
    notesAddedCount: input.notesAddedCount,
    questionsAskedCount: input.conversationCount,
  }
}
