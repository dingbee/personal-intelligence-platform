import { describe, expect, it } from 'vitest'
import { txtProcessor } from '@/modules/processing/extractors/txt'

function textFile(content: string): Blob {
  return new Blob([content], { type: 'text/plain' })
}

describe('txtProcessor', () => {
  it('preserves paragraph breaks (blank lines) already present in the source file', async () => {
    const result = await txtProcessor.extract(textFile('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'))

    expect(result.text.split(/\n{2,}/)).toEqual(['First paragraph.', 'Second paragraph.', 'Third paragraph.'])
  })

  it('normalizes CRLF line endings to LF without losing structure', async () => {
    const result = await txtProcessor.extract(textFile('Line one.\r\n\r\nLine two.'))

    expect(result.text).not.toContain('\r')
    expect(result.text.split(/\n{2,}/)).toEqual(['Line one.', 'Line two.'])
  })

  it('computes real word/char counts and reports no title/author/chapters/pageCount', async () => {
    const result = await txtProcessor.extract(textFile('one two three'))

    expect(result.wordCount).toBe(3)
    expect(result.charCount).toBe(result.text.length)
    expect(result.title).toBeNull()
    expect(result.author).toBeNull()
    expect(result.chapters).toBeNull()
    expect(result.pageCount).toBeNull()
  })

  it('extracts an empty file as empty text, not an error', async () => {
    const result = await txtProcessor.extract(textFile(''))

    expect(result.text).toBe('')
    expect(result.wordCount).toBe(0)
  })
})
