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

interface TextSlice {
  content: string
  start: number
  end: number
}

/**
 * Splits `text` into pieces no longer than `maxChars`, preferring to break at
 * whitespace so words survive intact. Falls back to a hard character split
 * only for a single unbroken run longer than `maxChars` (e.g. no whitespace
 * at all) — this is what guarantees every returned piece stays within the
 * limit, unlike a paragraph-preserving split which can't cap a paragraph
 * that has no internal break points.
 */
function splitLongText(text: string, maxChars: number): TextSlice[] {
  const pieces: TextSlice[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length)
    if (end < text.length) {
      const breakPoint = text.lastIndexOf(' ', end)
      if (breakPoint > start) end = breakPoint
    }
    const content = text.slice(start, end).trim()
    if (content) pieces.push({ content, start, end })
    start = end > start ? end : start + maxChars
  }
  return pieces
}

/**
 * Groups paragraphs (in order) into chunks up to ~MAX_CHUNK_CHARS. A
 * paragraph that already exceeds the limit on its own (e.g. an EPUB chapter
 * with no internal paragraph breaks) is split via `splitLongText` instead of
 * being kept whole, so no chunk — and therefore no embedding input — can
 * grow unbounded.
 */
export function chunkParagraphs(paragraphs: Paragraph[], startIndex = 0): Chunk[] {
  const chunks: Chunk[] = []
  let buffer: Paragraph[] = []
  let bufferLength = 0
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
    bufferLength = 0
  }

  for (const paragraph of paragraphs) {
    if (paragraph.text.length > MAX_CHUNK_CHARS) {
      flush()
      for (const piece of splitLongText(paragraph.text, MAX_CHUNK_CHARS)) {
        chunks.push({
          index,
          content: piece.content,
          charStart: paragraph.start + piece.start,
          charEnd: paragraph.start + piece.end,
          tokenCount: estimateTokenCount(piece.content),
          chapterIndex: null,
          chapterTitle: null,
        })
        index += 1
      }
      continue
    }

    if (bufferLength > 0 && bufferLength + paragraph.text.length > MAX_CHUNK_CHARS) {
      flush()
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
