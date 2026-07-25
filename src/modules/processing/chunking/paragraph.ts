import type { Chunk, ChunkInput, Chunker } from '@/modules/processing/chunking/types'
import { estimateTokenCount } from '@/modules/processing/chunking/types'

const MAX_CHUNK_CHARS = 1200

interface Paragraph {
  text: string
  start: number
  end: number
}

function splitParagraphs(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  let cursor = 0
  for (const block of text.split(/\n{2,}/)) {
    const start = text.indexOf(block, cursor)
    const trimmed = block.trim()
    if (trimmed) {
      paragraphs.push({ text: trimmed, start, end: start + block.length })
    }
    cursor = start + block.length
  }
  return paragraphs
}

/** Groups paragraphs (in order) into chunks up to ~MAX_CHUNK_CHARS, never splitting a paragraph. */
export function chunkParagraphs(paragraphs: Paragraph[], startIndex = 0): Chunk[] {
  const chunks: Chunk[] = []
  let buffer: Paragraph[] = []
  let index = startIndex

  function flush() {
    if (buffer.length === 0) return
    const content = buffer.map((p) => p.text).join('\n\n')
    chunks.push({
      index,
      content,
      charStart: buffer[0]!.start,
      charEnd: buffer[buffer.length - 1]!.end,
      tokenCount: estimateTokenCount(content),
      chapterIndex: null,
      chapterTitle: null,
    })
    index += 1
    buffer = []
  }

  let bufferLength = 0
  for (const paragraph of paragraphs) {
    if (bufferLength > 0 && bufferLength + paragraph.text.length > MAX_CHUNK_CHARS) {
      flush()
      bufferLength = 0
    }
    buffer.push(paragraph)
    bufferLength += paragraph.text.length
  }
  flush()

  return chunks
}

export const paragraphChunker: Chunker = {
  strategy: 'paragraph',
  chunk({ text }: ChunkInput): Chunk[] {
    return chunkParagraphs(splitParagraphs(text))
  },
}
