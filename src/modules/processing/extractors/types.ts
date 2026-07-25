import type { DocumentFileType, ExtractionChapterSummary } from '@/shared/types/database'

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
  /** Only populated for formats with real chapter structure (EPUB). */
  chapters: ExtractedChapter[] | null
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
