import { createNote } from '@/modules/notes/api/notes'
import { withArtifactKind, withCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'
import { formatDecisionAsNoteContent } from '@/modules/decision-intelligence/api/formatDecisionAsNoteContent'
import type { Decision } from '@/modules/decision-intelligence/decision'
import type { Note } from '@/shared/types/database'

/**
 * "Save the decision" — Phase 13's action-readiness hook, mirroring
 * savePlanToNote.ts exactly (same rationale: reuses the existing Notes/
 * generation_metadata convention rather than a dedicated table; the full
 * structure lives in generation_metadata.decision for a future phase to
 * read back, not just the rendered note body).
 */
export async function saveDecisionToNote(params: { decision: Decision; userId: string; workspaceId: string | null }): Promise<Note> {
  const { decision, userId, workspaceId } = params

  const content = formatDecisionAsNoteContent(decision)
  const generationMetadata = withCreationMethod(withArtifactKind({ question: decision.question, decisionId: decision.id, decision }, 'report'), 'ai_generated')

  return createNote({ userId, workspaceId, title: decision.title, content, generationMetadata })
}
