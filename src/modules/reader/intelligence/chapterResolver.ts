export interface ChapterLike {
  index: number
  title: string
}

export interface ChapterWithChunks extends ChapterLike {
  chunkIds: string[]
}

/**
 * UX-9 Phase 2/11 — pure lookups over chapters ReaderPage already has
 * loaded (useReaderChapters). Not a duplicate of referenceResolver.ts:
 * that resolves chunk IDs to chapters via a database lookup for
 * AIService's cross-document references; this operates entirely on the
 * in-memory chapter list for the one document currently open, and
 * produces hrefs using the exact same `?chapter=` convention
 * referenceFormatter.ts already established, so a Reader-generated link
 * and an AI-answer reference chip navigate identically.
 */
export function findChapterByIndex<T extends ChapterLike>(chapters: T[], index: number): T | null {
  return chapters.find((chapter) => chapter.index === index) ?? null
}

export function findAdjacentChapters<T extends ChapterLike>(
  chapters: T[],
  index: number,
): { previous: T | null; next: T | null } {
  return {
    previous: findChapterByIndex(chapters, index - 1),
    next: findChapterByIndex(chapters, index + 1),
  }
}

export function findChapterForChunkId(chapters: ChapterWithChunks[], chunkId: string): ChapterWithChunks | null {
  return chapters.find((chapter) => chapter.chunkIds.includes(chunkId)) ?? null
}

/** Same convention as referenceFormatter.ts's ChapterReference case — one href format, not two. */
export function buildChapterHref(documentId: string, chapterIndex: number): string {
  return `/library/${documentId}/read?chapter=${chapterIndex}`
}
