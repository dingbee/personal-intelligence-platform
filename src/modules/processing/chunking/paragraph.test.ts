import { describe, expect, it } from 'vitest'
import { paragraphChunker } from '@/modules/processing/chunking/paragraph'

// Same char-per-token heuristic the codebase already uses
// (estimateTokenCount in chunking/types.ts) and OpenAI's text-embedding-3-small
// input limit, for asserting chunks stay embedding-safe.
const OPENAI_EMBEDDING_MAX_TOKENS = 8191
const MAX_CHUNK_CHARS = 1200

describe('paragraphChunker', () => {
  it('groups normal multi-paragraph text (the TXT/plain-text path) into chunks under the size cap', () => {
    const text = Array.from({ length: 20 }, (_, i) => `Paragraph ${i}. `.repeat(20)).join('\n\n')
    const chunks = paragraphChunker.chunk({ text })

    expect(chunks.length).toBeGreaterThan(0)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS)
    }
    // Reassembling should still contain every paragraph's text (no data loss).
    expect(chunks.map((c) => c.content).join(' ')).toContain('Paragraph 0.')
    expect(chunks.map((c) => c.content).join(' ')).toContain('Paragraph 19.')
  })

  it('splits a single oversized paragraph (no internal breaks) instead of keeping it whole', () => {
    // Simulates an EPUB chapter that extracted with zero paragraph breaks —
    // one giant "paragraph" far larger than MAX_CHUNK_CHARS.
    const words = Array.from({ length: 6000 }, (_, i) => `word${i}`)
    const text = words.join(' ') // ~6000 * 7 chars ≈ 42,000 chars, no \n\n at all

    const chunks = paragraphChunker.chunk({ text })

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS)
      expect(chunk.tokenCount).toBeLessThan(OPENAI_EMBEDDING_MAX_TOKENS)
    }
    // No words dropped or duplicated across the split.
    const rejoined = chunks.map((c) => c.content).join(' ')
    expect(rejoined).toContain('word0')
    expect(rejoined).toContain('word5999')
  })

  it('hard-splits a pathological run with no whitespace at all', () => {
    const text = 'a'.repeat(10_000)
    const chunks = paragraphChunker.chunk({ text })

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS)
    }
    expect(chunks.reduce((sum, c) => sum + c.content.length, 0)).toBe(text.length)
  })

  it('never produces an empty chunk', () => {
    const chunks = paragraphChunker.chunk({ text: '   \n\n\n   ' })
    expect(chunks).toEqual([])
  })
})
