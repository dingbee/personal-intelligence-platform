import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { DocumentProcessor, ExtractionResult } from '@/modules/processing/extractors/types'
import { countWords, normalizeText } from '@/modules/processing/extractors/textStats'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

interface PdfInfo {
  Title?: string
  Author?: string
}

export const pdfProcessor: DocumentProcessor = {
  fileType: 'pdf',
  async extract(file: Blob): Promise<ExtractionResult> {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const pageTexts: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ')
      pageTexts.push(pageText)
    }

    const { info } = (await pdf.getMetadata()) as { info: PdfInfo }
    const text = normalizeText(pageTexts.join('\n\n'))

    return {
      text,
      title: info.Title?.trim() || null,
      author: info.Author?.trim() || null,
      language: null,
      pageCount: pdf.numPages,
      wordCount: countWords(text),
      charCount: text.length,
      chapters: null,
    }
  },
}
