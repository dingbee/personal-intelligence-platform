import type { Chunker, ChunkingStrategy } from '@/modules/processing/chunking/types'
import { fixedLengthChunker } from '@/modules/processing/chunking/fixedLength'
import { paragraphChunker } from '@/modules/processing/chunking/paragraph'
import { chapterAwareChunker } from '@/modules/processing/chunking/chapterAware'
import { semanticChunker } from '@/modules/processing/chunking/semantic'

const chunkers: Record<ChunkingStrategy, Chunker> = {
  'fixed-length': fixedLengthChunker,
  paragraph: paragraphChunker,
  'chapter-aware': chapterAwareChunker,
  semantic: semanticChunker,
}

export function getChunker(strategy: ChunkingStrategy): Chunker {
  return chunkers[strategy]
}
