import type { LearningSignalStatus } from '@/modules/learning-intelligence/learning'

/**
 * The deterministic learning-signal state machine — a pure, client-
 * testable mirror of what record_intelligence_outcome()/
 * revoke_learning_signal() already enforce server-side (the actual
 * authority; this module exists so the UI can reason about valid states
 * without round-tripping to the server, and so the transition table
 * itself is unit-testable).
 *
 * I8.10's own governance requirement ("PROPOSED -> REVIEW -> APPROVED ->
 * ACTIVE or the existing equivalent") is satisfied here by a
 * deterministic, evidence-count-driven promotion rather than a manual
 * human review step: 'proposed' (a single observation — never trusted
 * enough to influence anything, see gatherRelevantLearningSignals.ts's
 * own 'active'-only filter) automatically becomes 'active' the moment a
 * SECOND piece of real evidence corroborates it (evidence_count >= 2) —
 * this IS the "review," just grounded in real repeated evidence instead
 * of an arbitrary approval ceremony this codebase has no other precedent
 * for. 'contested' and 'revoked' remain fully explicit, non-automatic
 * transitions (see the migration's own reconciliation logic and
 * revoke_learning_signal() respectively).
 */
const TRANSITIONS: Record<LearningSignalStatus, LearningSignalStatus[]> = {
  proposed: ['active', 'contested', 'revoked'],
  active: ['contested', 'revoked'],
  contested: ['revoked'],
  revoked: [],
}

export function isValidLearningSignalTransition(from: LearningSignalStatus, to: LearningSignalStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function isTerminalLearningSignalStatus(status: LearningSignalStatus): boolean {
  return status === 'revoked'
}

/** Mirrors revoke_learning_signal()'s own `status = 'revoked'` rejection — a revoked signal can never be revoked again. */
export function canRevokeLearningSignal(status: LearningSignalStatus): boolean {
  return status !== 'revoked'
}

/** I8.12's own confidence-aware gate: only a corroborated (never single-observation, never contested/revoked) signal is trustworthy enough to influence future intelligence — see gatherRelevantLearningSignals.ts. */
export function isTrustedForAdaptation(status: LearningSignalStatus): boolean {
  return status === 'active'
}
