import { getNote } from '@/modules/notes/api/notes'
import { getWorkspaceObjective } from '@/modules/hub/api/objectives'
import type { Action } from '@/modules/action-intelligence/action'
import type { ExecutionRequest } from '@/modules/execution-foundation/execution'

export type OutcomeVerificationStatus = 'verified' | 'mismatch' | 'unverified'

/**
 * A self-reported execution success (`runSafeCapability` returning
 * `{outcome: 'succeeded'}`) is a CLAIM, not proof. I7.12/I7.13 require the
 * two to be kept as distinct facts rather than collapsed into one another:
 * this is the OBSERVED OUTCOME, recorded alongside — never instead of —
 * the attempt's own self-reported `outcome`.
 */
export interface OutcomeVerification {
  status: OutcomeVerificationStatus
  checkedAt: string
  details: string
}

/** PostgREST's code for ".single() found zero rows" — the one case where a re-read genuinely proves the claimed row does not exist. */
const POSTGREST_NOT_FOUND = 'PGRST116'

function isNotFoundError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === POSTGREST_NOT_FOUND
}

/**
 * Re-reads the real target row(s) a successful `runSafeCapability` call
 * claimed to have changed, and reports whether that claim actually holds.
 * Never infers success from the absence of a thrown exception during
 * execution alone — this performs an independent confirming read.
 *
 * Three, and only three, outcomes:
 *   - 'verified'   the target was re-read and genuinely reflects the claim
 *   - 'mismatch'   the target was re-read and does NOT reflect the claim
 *                  (including: the claimed row does not exist at all)
 *   - 'unverified' no confirming read could be performed (no id in the
 *                  result, an unrelated read error, or no verification
 *                  strategy exists for this capability) — this is an
 *                  honest "don't know", never coerced into 'verified'.
 */
export async function verifyOutcome(request: ExecutionRequest, result: Record<string, unknown> | null): Promise<OutcomeVerification> {
  const checkedAt = new Date().toISOString()

  switch (request.capability) {
    case 'save_action_to_notes': {
      const noteId = typeof result?.noteId === 'string' ? result.noteId : null
      if (!noteId) return { status: 'unverified', checkedAt, details: 'The execution result did not report a noteId to verify.' }
      try {
        const note = await getNote(noteId)
        return { status: 'verified', checkedAt, details: `Note ${note.id} was re-read and confirmed to exist.` }
      } catch (err) {
        if (isNotFoundError(err)) return { status: 'mismatch', checkedAt, details: `Reported noteId ${noteId} was not found on re-read — the claimed note does not exist.` }
        return { status: 'unverified', checkedAt, details: err instanceof Error ? err.message : 'The verification re-read failed unexpectedly.' }
      }
    }
    case 'add_action_as_workspace_objective': {
      const objectiveId = typeof result?.objectiveId === 'string' ? result.objectiveId : null
      if (!objectiveId) return { status: 'unverified', checkedAt, details: 'The execution result did not report an objectiveId to verify.' }
      try {
        const objective = await getWorkspaceObjective(objectiveId)
        return { status: 'verified', checkedAt, details: `Workspace objective ${objective.id} was re-read and confirmed to exist.` }
      } catch (err) {
        if (isNotFoundError(err)) return { status: 'mismatch', checkedAt, details: `Reported objectiveId ${objectiveId} was not found on re-read — the claimed objective does not exist.` }
        return { status: 'unverified', checkedAt, details: err instanceof Error ? err.message : 'The verification re-read failed unexpectedly.' }
      }
    }
    case 'link_action_to_workspace_objective': {
      const objectiveId = typeof result?.objectiveId === 'string' ? result.objectiveId : null
      if (!objectiveId) return { status: 'unverified', checkedAt, details: 'The execution result did not report an objectiveId to verify.' }
      const action = request.actionSnapshot as unknown as Action | null
      if (!action?.title) return { status: 'unverified', checkedAt, details: 'No action snapshot title was available to verify the link reference against.' }
      try {
        const objective = await getWorkspaceObjective(objectiveId)
        const reference = `Related action: ${action.title}`
        if (!objective.content.includes(reference)) {
          return { status: 'mismatch', checkedAt, details: `Objective ${objectiveId} was re-read but its content does not contain the expected reference to action "${action.title}".` }
        }
        return { status: 'verified', checkedAt, details: `Objective ${objectiveId} was re-read and confirmed to reference action "${action.title}".` }
      } catch (err) {
        if (isNotFoundError(err)) return { status: 'mismatch', checkedAt, details: `Reported objectiveId ${objectiveId} was not found on re-read — the claimed objective does not exist.` }
        return { status: 'unverified', checkedAt, details: err instanceof Error ? err.message : 'The verification re-read failed unexpectedly.' }
      }
    }
    default:
      return { status: 'unverified', checkedAt, details: `No verification strategy exists for capability "${request.capability}".` }
  }
}
