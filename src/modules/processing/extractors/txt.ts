import type { DocumentProcessor, ExtractionResult } from '@/modules/processing/extractors/types'
import { countWords, normalizeText } from '@/modules/processing/extractors/textStats'

export const txtProcessor: DocumentProcessor = {
  fileType: 'txt',
  async extract(file: Blob): Promise<ExtractionResult> {
    const raw = await file.text()
    const text = normalizeText(raw)
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
