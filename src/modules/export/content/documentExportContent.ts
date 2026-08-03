import type { DocumentWithTags } from '@/modules/library/api/documents'
import type { ExtractionMetadata } from '@/shared/types/database'
import { fileTypeLabel, formatFileSize } from '@/modules/library/utils/fileTypes'
import type { ExportContent, ExportSection } from '@/modules/export/types'

/**
 * Pure — takes an already-fetched document (with tags) and its already-
 * fetched extraction metadata (both already loaded on
 * `DocumentDetailPage`), no fetch here. Only title/type/size/tags/
 * extraction-derived counts ever reach `ExportContent` — no `id`/
 * `user_id`/`workspace_id`/`file_path`/`collection_id`. The original
 * file's own bytes never appear in any of the three human-readable
 * formats (they're plain text/PDF/DOCX, not a container for arbitrary
 * binary content) — only the NOVA Package path (`exportDocumentPackage`
 * + `buildDocumentPackageZip`, unmodified) ever carries the original
 * file, exactly as before this phase.
 */
export function buildDocumentExportContent(document: DocumentWithTags, metadata: ExtractionMetadata | null): ExportContent {
  const sections: ExportSection[] = []

  if (document.tags.length > 0) {
    sections.push({ heading: 'Tags', body: document.tags.map((tag) => tag.name), format: 'list' })
  }

  if (metadata) {
    const rows = [
      metadata.author && `Author: ${metadata.author}`,
      metadata.language && `Language: ${metadata.language}`,
      metadata.page_count != null && `Pages: ${metadata.page_count}`,
      metadata.chapter_count != null && `Chapters: ${metadata.chapter_count}`,
      metadata.word_count != null && `Words: ${metadata.word_count}`,
    ].filter((row): row is string => Boolean(row))
    if (rows.length > 0) sections.push({ heading: 'Details', body: rows, format: 'list' })
  }

  if (sections.length === 0) {
    sections.push({ body: ['No extracted metadata available for this document yet.'] })
  }

  return {
    title: document.title,
    subtitle: `${fileTypeLabel(document.file_type)} · ${formatFileSize(document.file_size)}`,
    sections,
  }
}
