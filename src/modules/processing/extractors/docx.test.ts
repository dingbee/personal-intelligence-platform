import { describe, expect, it, vi } from 'vitest'

// mammoth ships a browser-specific `unzip.js` (mapped via package.json's
// "browser" field) that its real, actual .docx zip parsing needs — that
// remapping is applied by Vite's client bundler but not by Vitest's
// (SSR-like) module resolution, so `mammoth.extractRawText({ arrayBuffer })`
// throws "Could not find file in options" here even though the identical
// call works correctly in the real, Vite-bundled browser app. This is the
// same category of Node/browser environment gap pdf.test.ts already
// documents for pdfjs-dist's own worker requirements — not reproducible in
// this test environment, and not a defect in either mammoth or docx.ts.
// mammoth's own real DOCX-parsing correctness is that library's concern,
// not this codebase's; what belongs to docx.ts and is tested for real
// below is its own wrapping logic — normalizeText, word/char counting, and
// the static null fields DOCX has no data for.
const extractRawTextMock = vi.fn()
vi.mock('mammoth', () => ({ default: { extractRawText: extractRawTextMock } }))

const { docxProcessor } = await import('@/modules/processing/extractors/docx')

function fakeFile(): Blob {
  return { arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Blob
}

describe('docxProcessor', () => {
  it('passes the file bytes to mammoth.extractRawText as arrayBuffer (the shape the real browser build of mammoth expects)', async () => {
    extractRawTextMock.mockResolvedValueOnce({ value: 'text' })
    const file = fakeFile()

    await docxProcessor.extract(file)

    expect(extractRawTextMock).toHaveBeenCalledWith({ arrayBuffer: expect.any(ArrayBuffer) })
  })

  it('normalizes mammoth output — CRLF and trailing-whitespace-before-newline cleanup, real paragraph breaks preserved', async () => {
    extractRawTextMock.mockResolvedValueOnce({ value: 'First paragraph.  \r\n\r\nSecond paragraph.\r\n\r\nThird paragraph.' })

    const result = await docxProcessor.extract(fakeFile())

    expect(result.text.split(/\n{2,}/)).toEqual(['First paragraph.', 'Second paragraph.', 'Third paragraph.'])
    expect(result.text).not.toContain('\r')
  })

  it('computes real word and char counts from the normalized text, and reports no title/author/chapters/pageCount (DOCX extraction has none of these)', async () => {
    extractRawTextMock.mockResolvedValueOnce({ value: 'one two three four five' })

    const result = await docxProcessor.extract(fakeFile())

    expect(result.wordCount).toBe(5)
    expect(result.charCount).toBe(result.text.length)
    expect(result.chapters).toBeNull()
    expect(result.pageCount).toBeNull()
    expect(result.title).toBeNull()
    expect(result.author).toBeNull()
  })

  it('extracts an empty document as empty text, not an error — a legitimately empty document is not a failure', async () => {
    extractRawTextMock.mockResolvedValueOnce({ value: '' })

    const result = await docxProcessor.extract(fakeFile())

    expect(result.text).toBe('')
    expect(result.wordCount).toBe(0)
    expect(result.charCount).toBe(0)
  })

  it('propagates a mammoth parse failure (e.g. a malformed/corrupted .docx) instead of masking it as a successful empty extraction', async () => {
    extractRawTextMock.mockRejectedValueOnce(new Error('end of central directory record signature not found'))

    await expect(docxProcessor.extract(fakeFile())).rejects.toThrow('end of central directory record signature not found')
  })
})
