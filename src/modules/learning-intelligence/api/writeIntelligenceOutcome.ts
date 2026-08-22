import { recordIntelligenceOutcome } from '@/modules/learning-intelligence/api/recordIntelligenceOutcome'
import type { OutcomeEvaluation, RecordIntelligenceOutcomeParams } from '@/modules/learning-intelligence/learning'

/**
 * Best-effort learning-signal persistence, mirroring
 * writeIntelligenceRecord.ts's own "log and continue" convention exactly
 * — used only by AUTOMATIC system-observed outcome recording (currently
 * recordExecutionIntelligenceRecord.ts's own I7 -> I8 wiring), where a
 * learning-layer failure must never be mistaken for the execution itself
 * failing. A user-initiated "record what happened" UI action should call
 * recordIntelligenceOutcome.ts directly instead, so the user actually
 * sees a real error if it fails.
 */
export async function writeIntelligenceOutcome(params: RecordIntelligenceOutcomeParams): Promise<OutcomeEvaluation | null> {
  try {
    return await recordIntelligenceOutcome(params)
  } catch (err) {
    console.error('[learning-intelligence] failed to persist an outcome evaluation', err)
    return null
  }
}
