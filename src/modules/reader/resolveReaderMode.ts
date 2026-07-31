import type { DocumentFileType } from '@/shared/types/database'

/**
 * UX-13.8.1 — which reading experience a file type gets, and the single
 * place that decision is made (ReaderPage and any entry point that needs
 * to know "is this document readable" — DocumentCard's Read button/menu
 * item — both call this rather than hand-rolling their own file-type
 * check). 'pdf' gets the canvas/text-layer page view (PdfReaderView);
 * every other currently-supported format gets the same reflowed-chunk-text
 * pane EPUB has always used — that pane was never actually EPUB-specific,
 * it just reads document_chunks, which every extractor already produces.
 * A future format (e.g. images) adds one more case here, not a new route.
 *
 * UX-13 Phase B — 'spreadsheet' is the third mode: xlsx/csv/ods get a
 * grid/sheet-tab view (SpreadsheetReaderView) instead of reflowed prose,
 * since a spreadsheet's structure (rows/columns/sheets) is the point, not
 * something to flatten into paragraphs the way document text is.
 */
export type ReaderMode = 'pdf' | 'text' | 'spreadsheet'

export function resolveReaderMode(fileType: DocumentFileType): ReaderMode | null {
  switch (fileType) {
    case 'pdf':
      return 'pdf'
    case 'epub':
    case 'txt':
    case 'markdown':
    case 'docx':
      return 'text'
    case 'xlsx':
    case 'csv':
    case 'ods':
      return 'spreadsheet'
    default:
      return null
  }
}
