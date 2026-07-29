import { listHighlights } from '@/modules/reader/api/highlights'
import { listFlashcards } from '@/modules/reader/api/flashcards'
import { listChapterSummaries } from '@/modules/reader/api/chapterSummaries'
import { listNotes } from '@/modules/notes/api/notes'
import { listConversations } from '@/modules/ai/chat/api/conversations'
import { findChapterByIndex } from '@/modules/reader/intelligence/chapterResolver'
import { computeReadingInsights, type ReadingInsight } from '@/modules/reader/intelligence/readingInsights'
import { detectReadingSignals } from '@/modules/reader/intelligence/readingSignals'
import { generateChapterSuggestions, type ChapterSuggestion } from '@/modules/reader/intelligence/chapterSuggestions'
import { computeDocumentJourney, type DocumentJourney } from '@/modules/reader/intelligence/documentJourney'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'

export interface ReaderInteractionState {
  document: { id: string; title: string }
  chapter: { index: number; title: string }
  progress: { scrollFraction: number }
  insights: ReadingInsight[]
  signals: IntelligenceSignal[]
  suggestions: ChapterSuggestion[]
  journey: DocumentJourney
  references: Reference[]
}

export interface BuildReaderInteractionStateParams {
  documentId: string
  documentTitle: string
  chapters: { index: number; title: string; content: string; chunkIds: string[] }[]
  activeChapterIndex: number
  scrollFraction: number
  progressUpdatedAt: string | null
  /** From the most recent Reader Chat turn, if any (AIService's references/contextTrace via ReaderChatPanel) — reused, never recomputed here. */
  references?: Reference[]
  graphNodeCount?: number
}

/**
 * UX-9 Phase 8 — the one fetch-and-compose point for Reader Intelligence,
 * mirroring UX-8's orchestrator.ts: every fetch reuses an existing API
 * function (listHighlights/listFlashcards/listChapterSummaries/listNotes/
 * listConversations, all pre-existing or — for listChapterSummaries —
 * a trivial extension of one), and every decision is delegated to a pure
 * function in this same directory. No AI call, no schema.
 */
export async function buildReaderInteractionState(params: BuildReaderInteractionStateParams): Promise<ReaderInteractionState> {
  const [highlights, flashcards, summaries, notes, conversations] = await Promise.all([
    listHighlights(params.documentId).catch(() => []),
    listFlashcards(params.documentId).catch(() => []),
    listChapterSummaries(params.documentId).catch(() => []),
    listNotes({ documentId: params.documentId }).catch(() => []),
    listConversations({ workspaceId: null, documentId: params.documentId }).catch(() => []),
  ])

  const currentChapterHighlights = highlights.filter((h) => h.chapter_index === params.activeChapterIndex)
  const currentChapterFlashcards = flashcards.filter((f) => f.chapter_index === params.activeChapterIndex)
  const currentChapterSummary = summaries.find((s) => s.chapter_index === params.activeChapterIndex) ?? null

  const insights = computeReadingInsights({ chapters: params.chapters, highlights, summaries })

  const signals = detectReadingSignals({
    chapterIndex: params.activeChapterIndex,
    totalChapters: params.chapters.length,
    scrollFraction: params.scrollFraction,
    currentChapterHighlightCount: currentChapterHighlights.length,
    currentChapterHasSummary: Boolean(currentChapterSummary),
    unreviewedHighlightCount: highlights.filter((h) => h.note === null).length,
    progressUpdatedAt: params.progressUpdatedAt,
    graphNodeCount: params.graphNodeCount,
  })

  const suggestions = generateChapterSuggestions({
    hasSummary: Boolean(currentChapterSummary),
    hasFlashcards: currentChapterFlashcards.length > 0,
    highlightCount: currentChapterHighlights.length,
    hasGraphContext: (params.graphNodeCount ?? 0) > 0,
  })

  const journey = computeDocumentJourney({
    hasProgress: params.progressUpdatedAt !== null,
    chapterIndex: params.activeChapterIndex,
    totalChapters: params.chapters.length,
    scrollFraction: params.scrollFraction,
    progressUpdatedAt: params.progressUpdatedAt,
    summarizedChapterCount: summaries.length,
    flashcardCount: flashcards.length,
    notesAddedCount: notes.length,
    conversationCount: conversations.length,
  })

  const currentChapter = findChapterByIndex(params.chapters, params.activeChapterIndex)

  return {
    document: { id: params.documentId, title: params.documentTitle },
    chapter: { index: params.activeChapterIndex, title: currentChapter?.title ?? `Chapter ${params.activeChapterIndex + 1}` },
    progress: { scrollFraction: params.scrollFraction },
    insights,
    signals,
    suggestions,
    journey,
    references: params.references ?? [],
  }
}
