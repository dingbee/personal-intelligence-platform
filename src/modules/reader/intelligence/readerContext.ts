import { findAdjacentChapters, findChapterByIndex } from '@/modules/reader/intelligence/chapterResolver'

export interface ReaderContext {
  documentId: string
  documentTitle: string
  chapterIndex: number
  chapterTitle: string
  previousChapterTitle: string | null
  nextChapterTitle: string | null
  scrollFraction: number
  /** Text of a highlight the user just made/selected, if any — null when there's no active selection. */
  activeHighlightQuote: string | null
}

export interface BuildReaderContextParams {
  documentId: string
  documentTitle: string
  chapters: { index: number; title: string }[]
  activeChapterIndex: number
  scrollFraction: number
  activeHighlightQuote?: string | null
}

/**
 * UX-9 Phase 3 — "what NOVA should know without asking again," assembled
 * purely from ReaderPage's own already-loaded state (useReaderChapters,
 * useReadingProgress) — no new fetch, no duplicated Reader state. The
 * previous/next chapter lookup is chapterResolver.ts's job; this just
 * packages the result into one context object for readerInteraction.ts
 * and ReaderChatPanel.
 */
export function buildReaderContext(params: BuildReaderContextParams): ReaderContext {
  const current = findChapterByIndex(params.chapters, params.activeChapterIndex)
  const { previous, next } = findAdjacentChapters(params.chapters, params.activeChapterIndex)

  return {
    documentId: params.documentId,
    documentTitle: params.documentTitle,
    chapterIndex: params.activeChapterIndex,
    chapterTitle: current?.title ?? `Chapter ${params.activeChapterIndex + 1}`,
    previousChapterTitle: previous?.title ?? null,
    nextChapterTitle: next?.title ?? null,
    scrollFraction: params.scrollFraction,
    activeHighlightQuote: params.activeHighlightQuote ?? null,
  }
}
