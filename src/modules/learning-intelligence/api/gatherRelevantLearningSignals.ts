import { listActiveSignalsByPatternPrefix } from '@/modules/learning-intelligence/api/learningQueries'
import type { LearningSignal } from '@/modules/learning-intelligence/learning'

const MAX_SIGNALS = 5

export interface RelevantLearningSignal {
  statement: string
  direction: LearningSignal['direction']
  strength: LearningSignal['strength']
  evidenceCount: number
}

/**
 * I8.12 Adaptation's own read path, wired into Action Intelligence's own
 * buildActionContext.ts (see that file). Only 'active' signals ever come
 * back (see isTrustedForAdaptation/listActiveSignalsByPatternPrefix's own
 * 'active'-only filter) — a single-observation 'proposed' signal, a
 * 'contested' one, or a 'revoked' one never reaches a prompt. This is the
 * ONE integration point this sprint wires end to end (Action
 * Intelligence, since I8.18 is where verified outcome evidence actually
 * accumulates); Decision/Planning Intelligence's own prompt pipelines are
 * deliberately left untouched — extending adaptation to them is real,
 * separate follow-up work, not silently done here.
 *
 * Explicit, never a hidden prompt mutation: the caller decides how (and
 * whether) to render this in its own prompt — see
 * formatActionContextForPrompt.ts, which labels this section plainly as
 * "past outcome patterns," never as an instruction.
 */
export async function gatherRelevantLearningSignals(patternPrefix: string): Promise<RelevantLearningSignal[]> {
  const signals = await listActiveSignalsByPatternPrefix(patternPrefix)
  return signals.slice(0, MAX_SIGNALS).map((s) => ({ statement: s.statement, direction: s.direction, strength: s.strength, evidenceCount: s.evidenceCount }))
}
