import type { Note, Tag } from '@/shared/types/database'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageExporter } from '@/modules/knowledge-exchange/packages/PackageExporter'
import type { NotePackage } from '@/modules/knowledge-exchange/notes/notePackageTypes'

/** Pure — takes an already-fetched note and its already-fetched tags, builds the versioned package. No Supabase call here; the export button's caller fetches both first (the note is already loaded on NoteDetailPage, tags via useNoteTags). */
export function exportNotePackage(note: Note, tags: Tag[]): NotePackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceVersion: PACKAGE_SOURCE_VERSION,
    note: {
      title: note.title,
      content: note.content,
      tags: tags.map((tag) => tag.name),
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      generationMetadata: note.generation_metadata,
    },
  }
}

export const notePackageExporter: PackageExporter<{ note: Note; tags: Tag[] }, NotePackage> = {
  export: ({ note, tags }) => exportNotePackage(note, tags),
}

/** Filesystem-safe, lowercase-hyphenated filename — same pattern `knowledgeExportFilename` already established for the markdown export. */
export function notePackageFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'note-export'}.json`
}
