import type { Chunk, ChunkInput, Chunker } from '@/modules/processing/chunking/types'
import { estimateTokenCount } from '@/modules/processing/chunking/types'

const TARGET_CHARS = 1000
const OVERLAP_CHARS = 100

export const fixedLengthChunker: Chunker = {
  strategy: 'fixed-length',
  chunk({ text }: ChunkInput): Chunk[] {
    const chunks: Chunk[] = []
    let start = 0
    let index = 0

    while (start < text.length) {
      const end = Math.min(start + TARGET_CHARS, text.length)
      const content = text.slice(start, end).trim()
      if (content) {
        chunks.push({
          index,
          content,
          charStart: start,
          charEnd: end,
          tokenCount: estimateTokenCount(content),
          chapterIndex: null,
          chapterTitle: null,
        })
        index += 1
      }
      if (end >= text.length) break
      start = end - OVERLAP_CHARS
    }

    return chunks
  },
}
