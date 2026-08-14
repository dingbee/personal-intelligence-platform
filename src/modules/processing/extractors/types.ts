import type { DocumentFileType, ExtractionChapterSummary } from '@/shared/types/database'
import type { SheetAnalysis, StructuredSheet } from '@/modules/processing/spreadsheet/types'

export interface ExtractedChapter {
  index: number
  title: string
  text: string
}

export interface ExtractionResult {
  text: string
  title: string | null
  author: string | null
  language: string | null
  pageCount: number | null
  wordCount: number
  charCount: number
  /** Populated for formats with a real chapter structure (EPUB) or a natural page structure (PDF, one chapter per page). Null for plain text formats with neither. */
  chapters: ExtractedChapter[] | null
  /** UX-13.10 — populated only by the spreadsheet extractor, computed from the same typed cell grid SheetJS produces before it's serialized to markdown for `chapters`/`text`. Null for every other format. */
  spreadsheetAnalysis?: SheetAnalysis[]
  /**
   * Data Intelligence Foundation — the complete row/column grid per sheet,
   * built from the exact same typed `rows` array `spreadsheetAnalysis` is
   * derived from (not a re-parse). Additive to `spreadsheetAnalysis` (the
   * fixed upload-time statistics battery) and `chapters` (the markdown-
   * table RAG text) — both of those stay exactly as they are; this is a
   * third, parallel representation persisted separately so a deterministic
   * query engine can execute arbitrary filter/group/aggregate operations
   * the fixed statistics battery didn't anticipate. Populated only by the
   * spreadsheet extractor, null for every other format.
   */
  structuredData?: StructuredSheet[]
}

/**
 * Converts an ExtractionResult's chapters into the lightweight summary shape
 * stored in `extraction_metadata.metadata` (title + index only — full
 * chapter text lives in document_chunks / is re-derived by the reader).
 */
export function toChapterSummaries(
  chapters: ExtractedChapter[] | null,
): ExtractionChapterSummary[] | undefined {
  return chapters?.map((chapter) => ({ index: chapter.index, title: chapter.title }))
}

export interface DocumentProcessor {
  fileType: DocumentFileType
  extract(file: Blob): Promise<ExtractionResult>
}
