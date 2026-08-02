import { createNote } from '@/modules/notes/api/notes'
import { addTagToNote } from '@/modules/notes/api/noteTags'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'
import type { Note } from '@/shared/types/database'
import type { PackageImportContext, PackageImporter } from '@/modules/knowledge-exchange/packages/PackageImporter'
import type { NotePackage } from '@/modules/knowledge-exchange/notes/notePackageTypes'

/**
 * Always `createNote` (insert) — never an update/upsert against an
 * existing row — so an import can never overwrite an existing note by
 * construction, not by a defensive check. The importer becomes the
 * owner (`userId` from context, exactly like every other "create a
 * note" path in this app); a fresh id comes from the same `insert()`
 * path every other create operation already uses. The package's own
 * `id` never existed for a note in the first place (see
 * `notePackageTypes.ts`), so there's nothing to preserve or collide with.
 *
 * Original timestamps travel as inert `generation_metadata.importedFrom`
 * data only — the new row's own `created_at`/`updated_at` are whatever
 * the database sets on insert, correctly reflecting when *this account*
 * received it, per the discovery doc's §3.3/§3.4.
 *
 * Re-runs the same integration steps every other note-creation path in
 * this app already runs (`useNotes.create`, `SaveConversationDialog`,
 * `generateBriefing`): re-resolve tags by name (find-or-create in the
 * importer's own account, via the same `ensureTag`-backed
 * `addTagToNote` ordinary tag creation already uses — never a
 * reference to the exporter's `tags.id`), search indexing, and
 * concept-mention linking. An imported note is, from the moment this
 * function returns, indistinguishable at the database level from any
 * other note the importer created by hand (discovery doc §4.3).
 */
export async function importNotePackage(pkg: NotePackage, context: PackageImportContext): Promise<Note> {
  const note = await createNote({
    userId: context.userId,
    workspaceId: context.workspaceId,
    title: pkg.note.title,
    content: pkg.note.content,
    generationMetadata: {
      ...(pkg.note.generationMetadata ?? {}),
      importedFrom: {
        packageVersion: pkg.version,
        sourceVersion: pkg.sourceVersion,
        exportedAt: pkg.exportedAt,
        originalCreatedAt: pkg.note.createdAt,
        originalUpdatedAt: pkg.note.updatedAt,
        importedAt: new Date().toISOString(),
      },
    },
  })

  for (const tagName of pkg.note.tags) {
    await addTagToNote({ noteId: note.id, tagName, userId: context.userId })
  }

  void indexNote(note, context.workspaceId)
  void linkKnownConceptsToSource({
    userId: context.userId,
    sourceType: 'note',
    sourceId: note.id,
    text: `${note.title}\n\n${note.content}`,
  })

  return note
}

export const notePackageImporter: PackageImporter<NotePackage, Note> = {
  import: importNotePackage,
}
