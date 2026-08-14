import { createNote } from '@/modules/notes/api/notes'
import { withArtifactKind, withCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'
import { formatPlanAsNoteContent } from '@/modules/planning-intelligence/api/formatPlanAsNoteContent'
import type { Plan } from '@/modules/planning-intelligence/plan'
import type { Note } from '@/shared/types/database'

/**
 * "Save the plan" — Phase 8's action-readiness hook. Reuses the exact
 * Notes/generation_metadata convention saveResearchToNote.ts already
 * established, rather than a dedicated `plans` persistence table:
 * naming a new table `plans` would collide with the existing billing
 * plans table (see 0062's own migration comment), and a Note already
 * losslessly represents everything a freshly generated Plan carries.
 * This is also the concrete "future execution can consume the plan"
 * seam the brief asks for without building it yet: a saved plan's full
 * structure lives in generation_metadata.plan (not just the rendered
 * note body), so a future phase can read it back and resume/execute it
 * without re-deriving anything from prose.
 */
export async function savePlanToNote(params: { plan: Plan; userId: string; workspaceId: string | null }): Promise<Note> {
  const { plan, userId, workspaceId } = params

  const content = formatPlanAsNoteContent(plan)
  const generationMetadata = withCreationMethod(withArtifactKind({ objective: plan.objective, planId: plan.id, plan }, 'report'), 'ai_generated')

  return createNote({ userId, workspaceId, title: plan.title, content, generationMetadata })
}
