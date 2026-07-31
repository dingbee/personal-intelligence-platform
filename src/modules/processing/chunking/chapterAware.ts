import type { Chunk, ChunkInput, Chunker } from '@/modules/processing/chunking/types'
import { paragraphChunker } from '@/modules/processing/chunking/paragraph'

/**
 * Chunks chapter-by-chapter, tagging each chunk with its chapter. Falls back
 * to plain paragraph chunking over the full text when no chapter structure
 * is available (EPUB extraction produces real chapters; PDF extraction
 * produces one chapter per page — UX-13.7.1).
 *
 * Note: `charStart`/`charEnd` are relative to each chapter's own text, not
 * a single offset space across the whole document — chapters are extracted
 * and stored as independent units, so there's no shared document string to
 * offset against.
 */
export const chapterAwareChunker: Chunker = {
  strategy: 'chapter-aware',
  chunk(input: ChunkInput): Chunk[] {
    const { chapters } = input
    if (!chapters || chapters.length === 0) {
      return paragraphChunker.chunk(input)
    }

    const chunks: Chunk[] = []
    let nextIndex = 0
    for (const chapter of chapters) {
      const chapterChunks = paragraphChunker.chunk({ text: chapter.text })
      for (const chunk of chapterChunks) {
        chunks.push({
          ...chunk,
          index: nextIndex,
          chapterIndex: chapter.index,
          chapterTitle: chapter.title,
        })
        nextIndex += 1
      }
    }
    return chunks
  },
}
