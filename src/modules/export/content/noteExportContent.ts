import type { Note, Tag } from '@/shared/types/database'
import type { ExportContent } from '@/modules/export/types'

/**
 * Pure — takes an already-fetched note and its already-fetched tags (both
 * already loaded on `NoteDetailPage`), no fetch here. Only `title`/
 * `content`/tag `name`s ever reach `ExportContent` — no `id`/`user_id`/
 * `workspace_id`/`source_chunk_ids`/`generation_metadata`, the same
 * allow-list discipline `exportNotePackage` already established for the
 * NOVA Package path.
 */
export function buildNoteExportContent(note: Note, tags: Tag[]): ExportContent {
  const paragraphs = note.content.split(/\n{2,}/).filter((paragraph) => paragraph.trim() !== '')
  return {
    title: note.title,
    subtitle: tags.length > 0 ? `Tags: ${tags.map((tag) => tag.name).join(', ')}` : undefined,
    sections: [{ body: paragraphs.length > 0 ? paragraphs : [''] }],
  }
}
