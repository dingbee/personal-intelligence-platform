import { createNote } from '@/modules/notes/api/notes'
import { withArtifactKind, withCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'
import { formatActionSetAsNoteContent } from '@/modules/action-intelligence/api/formatActionSetAsNoteContent'
import type { ActionSet } from '@/modules/action-intelligence/action'
import type { Note } from '@/shared/types/database'

/**
 * "Save the action set" — Phase 14's action-readiness hook, mirroring
 * saveDecisionToNote.ts exactly: reuses the existing Notes/
 * generation_metadata convention rather than a dedicated table. The full
 * structure lives in generation_metadata.actionSet for a future phase to
 * read back, not just the rendered note body.
 */
export async function saveActionSetToNote(params: { actionSet: ActionSet; userId: string; workspaceId: string | null }): Promise<Note> {
  const { actionSet, userId, workspaceId } = params

  const content = formatActionSetAsNoteContent(actionSet)
  const generationMetadata = withCreationMethod(withArtifactKind({ title: actionSet.title, actionSetId: actionSet.id, actionSet }, 'report'), 'ai_generated')

  return createNote({ userId, workspaceId, title: actionSet.title, content, generationMetadata })
}
