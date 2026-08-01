import type { Note } from '@/shared/types/database'
import { createNote, deleteNote } from '@/modules/notes/api/notes'
import { addTagToNote, listTagsForNote } from '@/modules/notes/api/noteTags'
import { buildMergedNoteContent, buildMergedNoteTitle } from '@/modules/notes/utils/mergeNotes'
import { addItemToCollection, listCollectionsContainingItem } from '@/modules/knowledge-intelligence/api/knowledgeCollections'

/**
 * Knowledge Actions v1 — Merge Notes. Creates one new note carrying the
 * union of the selected notes' content and tags, then deletes the
 * originals. Tag union reuses the existing note_tags find-or-create path
 * (addTagToNote/ensureTag) rather than a bulk insert, since the note
 * count here is always small (a user manually selects a handful of notes
 * to merge, not hundreds).
 *
 * Platform Integration Sprint: also carries forward Collection membership
 * — before this, merging two notes that were both in, say, a "Trip
 * Planning" collection silently dropped that membership, since the
 * originals (and their knowledge_links rows) get deleted and the new note
 * starts with none. Reuses the exact same lookup/write functions the
 * Collections UI itself uses (listCollectionsContainingItem/
 * addItemToCollection), not a parallel implementation.
 */
export async function mergeNotesIntoOne(params: {
  userId: string
  workspaceId: string | null
  notes: Note[]
}): Promise<Note> {
  const { userId, workspaceId, notes } = params

  const tagLists = await Promise.all(notes.map((note) => listTagsForNote(note.id)))
  const tagNames = Array.from(new Set(tagLists.flat().map((tag) => tag.name)))

  const collectionLists = await Promise.all(notes.map((note) => listCollectionsContainingItem('note', note.id)))
  const collectionIds = Array.from(new Set(collectionLists.flat().map((collection) => collection.id)))

  const merged = await createNote({
    userId,
    workspaceId,
    title: buildMergedNoteTitle(notes),
    content: buildMergedNoteContent(notes),
  })

  await Promise.all(tagNames.map((tagName) => addTagToNote({ noteId: merged.id, tagName, userId })))
  await Promise.all(
    collectionIds.map((collectionId) =>
      addItemToCollection({ userId, workspaceId, collectionId, itemType: 'note', itemId: merged.id }),
    ),
  )
  await Promise.all(notes.map((note) => deleteNote(note.id)))

  return merged
}
