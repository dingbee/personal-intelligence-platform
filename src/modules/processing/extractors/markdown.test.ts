import { describe, expect, it } from 'vitest'
import { markdownProcessor } from '@/modules/processing/extractors/markdown'

function markdownFile(content: string): Blob {
  return new Blob([content], { type: 'text/markdown' })
}

describe('markdownProcessor', () => {
  it('extracts the first H1 as the document title, stripped of markdown syntax', async () => {
    const result = await markdownProcessor.extract(markdownFile('# My Document Title\n\nSome body text.'))

    expect(result.title).toBe('My Document Title')
  })

  it('reports no title when there is no H1 heading', async () => {
    const result = await markdownProcessor.extract(markdownFile('Just a paragraph, no heading at all.'))

    expect(result.title).toBeNull()
  })

  it('strips heading markers, bold/italic markers, links, and blockquote markers while preserving paragraph structure', async () => {
    const md = [
      '# Title',
      '',
      '## Section Heading',
      '',
      'A paragraph with **bold** and *italic* text, plus a [link](https://example.com).',
      '',
      '> A blockquote line.',
    ].join('\n')

    const result = await markdownProcessor.extract(markdownFile(md))

    expect(result.text).not.toContain('#')
    expect(result.text).not.toContain('**')
    expect(result.text).not.toContain('[link]')
    expect(result.text).not.toContain('>')
    expect(result.text).toContain('Section Heading')
    expect(result.text).toContain('bold')
    expect(result.text).toContain('italic')
    expect(result.text).toContain('link')
    expect(result.text).toContain('A blockquote line.')
    // Paragraph breaks (blank lines) in the source survive stripping.
    expect(result.text.split(/\n{2,}/).length).toBeGreaterThan(1)
  })

  it('preserves code block content while dropping the fence markers', async () => {
    const md = 'Before.\n\n```js\nconst x = 1;\n```\n\nAfter.'

    const result = await markdownProcessor.extract(markdownFile(md))

    expect(result.text).not.toContain('```')
    expect(result.text).toContain('const x = 1;')
  })

  it('computes real word/char counts and reports no author/chapters/pageCount', async () => {
    const result = await markdownProcessor.extract(markdownFile('one two three'))

    expect(result.wordCount).toBe(3)
    expect(result.charCount).toBe(result.text.length)
    expect(result.author).toBeNull()
    expect(result.chapters).toBeNull()
    expect(result.pageCount).toBeNull()
  })

  it('extracts an empty file as empty text, not an error', async () => {
    const result = await markdownProcessor.extract(markdownFile(''))

    expect(result.text).toBe('')
    expect(result.title).toBeNull()
  })
})
