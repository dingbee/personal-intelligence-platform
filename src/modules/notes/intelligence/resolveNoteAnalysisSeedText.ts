import { getNote } from '@/modules/notes/api/notes'
import { buildNoteAnalysisSeedQuery } from '@/modules/notes/intelligence/buildNoteAnalysisSeedQuery'

/**
 * PIP Reliability Sprint 2/10 — was an uncaught `getNote(...).then(...)`
 * inline in ChatPage.tsx: a deleted note, or one RLS denies access to
 * (getNote's `.single()` throws either way — the same code path covers
 * both "doesn't exist" and "not yours to see," which is the correct,
 * information-non-leaking behavior), used to fail silently: an unhandled
 * promise rejection, an empty conversation, no feedback at all. Pulled out
 * into its own function so both the success path (real content reaches the
 * seed) and the failure path (an honest, visible message instead of
 * silence) are directly testable without rendering all of ChatPage.
 */
export async function resolveNoteAnalysisSeedText(noteId: string): Promise<string> {
  try {
    const note = await getNote(noteId)
    return buildNoteAnalysisSeedQuery(note.title, note.content)
  } catch {
    return "I tried to open a note to analyze, but couldn't access it — it may have been deleted, or you may not have permission to view it."
  }
}
