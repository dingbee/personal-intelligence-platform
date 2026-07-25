import type { ExtractedChapter } from '@/modules/processing/extractors/types'

export interface ChunkInput {
  text: string
  chapters?: ExtractedChapter[] | null
}

export interface Chunk {
  index: number
  content: string
  charStart: number
  charEnd: number
  tokenCount: number
  chapterIndex: number | null
  chapterTitle: string | null
}

export type ChunkingStrategy = 'fixed-length' | 'paragraph' | 'chapter-aware' | 'semantic'

export interface Chunker {
  strategy: ChunkingStrategy
  chunk(input: ChunkInput): Chunk[]
}

/** ~4 characters per token is a common rough heuristic for English prose. */
export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}
