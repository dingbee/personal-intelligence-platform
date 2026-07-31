import type { DocumentFileType } from '@/shared/types/database'
import type { DocumentProcessor } from '@/modules/processing/extractors/types'

// Lazy-loaded per file type: pdfjs-dist, mammoth, and jszip are ~1MB
// combined and most sessions only ever touch one or two file types, so
// there's no reason to ship all of them in the main bundle.
const loaders: Record<DocumentFileType, () => Promise<DocumentProcessor>> = {
  pdf: () => import('@/modules/processing/extractors/pdf').then((m) => m.pdfProcessor),
  epub: () => import('@/modules/processing/extractors/epub').then((m) => m.epubProcessor),
  docx: () => import('@/modules/processing/extractors/docx').then((m) => m.docxProcessor),
  txt: () => import('@/modules/processing/extractors/txt').then((m) => m.txtProcessor),
  markdown: () => import('@/modules/processing/extractors/markdown').then((m) => m.markdownProcessor),
  xlsx: () => import('@/modules/processing/extractors/spreadsheet').then((m) => m.xlsxProcessor),
  csv: () => import('@/modules/processing/extractors/spreadsheet').then((m) => m.csvProcessor),
  ods: () => import('@/modules/processing/extractors/spreadsheet').then((m) => m.odsProcessor),
}

export function getDocumentProcessor(fileType: DocumentFileType): Promise<DocumentProcessor> {
  return loaders[fileType]()
}
