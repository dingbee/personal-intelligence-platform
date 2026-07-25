import mammoth from 'mammoth'
import type { DocumentProcessor, ExtractionResult } from '@/modules/processing/extractors/types'
import { countWords, normalizeText } from '@/modules/processing/extractors/textStats'

export const docxProcessor: DocumentProcessor = {
  fileType: 'docx',
  async extract(file: Blob): Promise<ExtractionResult> {
    const arrayBuffer = await file.arrayBuffer()
    const { value } = await mammoth.extractRawText({ arrayBuffer })
    const text = normalizeText(value)
    return {
      text,
      title: null,
      author: null,
      language: null,
      pageCount: null,
      wordCount: countWords(text),
      charCount: text.length,
      chapters: null,
    }
  },
}
