import type { DocumentProcessor, ExtractionResult } from '@/modules/processing/extractors/types'
import { countWords, normalizeText } from '@/modules/processing/extractors/textStats'

function stripMarkdownSyntax(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, '')) // keep code content, drop fences
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // links -> label
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // bold/italic
    .replace(/^>\s?/gm, '') // blockquotes
}

function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1]!.trim() : null
}

export const markdownProcessor: DocumentProcessor = {
  fileType: 'markdown',
  async extract(file: Blob): Promise<ExtractionResult> {
    const raw = await file.text()
    const title = extractTitle(raw)
    const text = normalizeText(stripMarkdownSyntax(raw))
    return {
      text,
      title,
      author: null,
      language: null,
      pageCount: null,
      wordCount: countWords(text),
      charCount: text.length,
      chapters: null,
    }
  },
}
