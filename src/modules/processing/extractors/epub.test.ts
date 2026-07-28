import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { epubProcessor } from '@/modules/processing/extractors/epub'
import { getChunker } from '@/modules/processing/chunking/registry'

const MAX_CHUNK_CHARS = 1200
const OPENAI_EMBEDDING_MAX_TOKENS = 8191

const CONTAINER_XML = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

function opfXml(chapterFiles: string[]) {
  const manifestItems = chapterFiles
    .map((file, i) => `<item id="chap${i}" href="${file}" media-type="application/xhtml+xml"/>`)
    .join('')
  const spineItems = chapterFiles.map((_, i) => `<itemref idref="chap${i}"/>`).join('')
  return `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>A Very Large Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>${manifestItems}</manifest>
  <spine>${spineItems}</spine>
</package>`
}

/** Many <p> tags packed on one line, no literal newlines between them — mirrors real (often minified) EPUB XHTML output. */
function manyParagraphsChapter(paragraphCount: number, wordsPerParagraph: number): string {
  const paragraphs = Array.from({ length: paragraphCount }, (_, i) =>
    `<p>Paragraph ${i}: ${Array.from({ length: wordsPerParagraph }, (_, w) => `word${w}`).join(' ')}.</p>`,
  ).join('')
  return `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body>${paragraphs}</body></html>`
}

/** A single unbroken paragraph with no internal breaks — the pathological case a real chapter can produce. */
function oneGiantParagraphChapter(wordCount: number): string {
  const text = Array.from({ length: wordCount }, (_, w) => `giantword${w}`).join(' ')
  return `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body><p>${text}</p></body></html>`
}

async function buildEpub(chapters: { file: string; xhtml: string }[]): Promise<Blob> {
  const zip = new JSZip()
  zip.file('META-INF/container.xml', CONTAINER_XML)
  zip.file(
    'OEBPS/content.opf',
    opfXml(chapters.map((c) => c.file)),
  )
  for (const chapter of chapters) {
    zip.file(`OEBPS/${chapter.file}`, chapter.xhtml)
  }
  return zip.generateAsync({ type: 'blob' })
}

describe('epubProcessor + chapter-aware chunking on a large EPUB-like document', () => {
  it('preserves paragraph breaks from <p> tags with no literal newlines between them', async () => {
    // ~300 paragraphs, no \n at all in the source markup — this is exactly
    // the shape that used to flatten into one unbroken blob via textContent.
    const file = await buildEpub([{ file: 'chap0.xhtml', xhtml: manyParagraphsChapter(300, 20) }])

    const result = await epubProcessor.extract(file)

    expect(result.chapters).toHaveLength(1)
    const chapterText = result.chapters![0]!.text
    expect(chapterText).toContain('\n\n')
    expect(chapterText).toContain('Paragraph 0:')
    expect(chapterText).toContain('Paragraph 299:')
  })

  it('produces only embedding-safe chunks for a large multi-chapter EPUB, including a pathological single-paragraph chapter', async () => {
    const chapters = [
      { file: 'chap0.xhtml', xhtml: manyParagraphsChapter(400, 25) }, // normal: many real paragraph breaks
      { file: 'chap1.xhtml', xhtml: oneGiantParagraphChapter(8000) }, // pathological: one giant paragraph, ~87k chars
    ]
    const file = await buildEpub(chapters)

    const result = await epubProcessor.extract(file)
    expect(result.chapters).toHaveLength(2)
    // Confirms this is a genuinely large document, not a trivial fixture.
    expect(result.charCount).toBeGreaterThan(50_000)

    const chunker = getChunker('chapter-aware')
    const chunks = chunker.chunk({ text: result.text, chapters: result.chapters })

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS)
      expect(chunk.tokenCount).toBeLessThan(OPENAI_EMBEDDING_MAX_TOKENS)
      expect(chunk.content.length).toBeGreaterThan(0)
    }

    // Every chunk is tagged with the chapter it came from.
    expect(chunks.some((c) => c.chapterIndex === 0)).toBe(true)
    expect(chunks.some((c) => c.chapterIndex === 1)).toBe(true)

    // The giant single-paragraph chapter must have been split into more than
    // one chunk — proof the oversized-paragraph fallback actually engaged.
    const chapter1Chunks = chunks.filter((c) => c.chapterIndex === 1)
    expect(chapter1Chunks.length).toBeGreaterThan(1)

    // No content lost across the split.
    const rejoined = chapter1Chunks.map((c) => c.content).join(' ')
    expect(rejoined).toContain('giantword0')
    expect(rejoined).toContain('giantword7999')
  })
})
