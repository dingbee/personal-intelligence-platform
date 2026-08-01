import type { Note } from '@/shared/types/database'
import { createNote, deleteNote } from '@/modules/notes/api/notes'
import { addTagToNote, listTagsForNote } from '@/modules/notes/api/noteTags'
import { buildMergedNoteContent, buildMergedNoteTitle } from '@/modules/notes/utils/mergeNotes'

/**
 * Knowledge Actions v1 — Merge Notes. Creates one new note carrying the
 * union of the selected notes' content and tags, then deletes the
 * originals. Tag union reuses the existing note_tags find-or-create path
 * (addTagToNote/ensureTag) rather than a bulk insert, since the note
 * count here is always small (a user manually selects a handful of notes
 * to merge, not hundreds).
 */
export async function mergeNotesIntoOne(params: {
  userId: string
  workspaceId: string | null
  notes: Note[]
}): Promise<Note> {
  const { userId, workspaceId, notes } = params

  const tagLists = await Promise.all(notes.map((note) => listTagsForNote(note.id)))
  const tagNames = Array.from(new Set(tagLists.flat().map((tag) => tag.name)))

  const merged = await createNote({
    userId,
    workspaceId,
    title: buildMergedNoteTitle(notes),
    content: buildMergedNoteContent(notes),
  })

  await Promise.all(tagNames.map((tagName) => addTagToNote({ noteId: merged.id, tagName, userId })))
  await Promise.all(notes.map((note) => deleteNote(note.id)))

  return merged
}
